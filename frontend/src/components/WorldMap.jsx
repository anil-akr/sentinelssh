import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { geoBounds, geoContains, geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
// Contours des pays (précision 1:50 millions, nets même zoomés), inclus
// dans le projet : la carte marche sans Internet.
import world from 'world-atlas/countries-50m.json'
import { countryName, totalFailures, worstSeverity } from '../format.js'
import SeverityBadge from './SeverityBadge.jsx'

// Taille du dessin ; le SVG s'adapte ensuite à la largeur de l'écran.
const WIDTH = 960
const HEIGHT = 480
const MAX_ZOOM = 8

// Vue de départ : pas de zoom (k = 1), pas de décalage (x = 0, y = 0).
const START = { k: 1, x: 0, y: 0 }

// Calculés une seule fois, au chargement du fichier :
// - countries : les pays au format GeoJSON (topojson est un format compressé) ;
// - projection : transforme [longitude, latitude] en [x, y] sur le dessin ;
// - path : transforme une forme géographique en attribut « d » d'un <path> SVG ;
// - shapes : chaque pays avec son tracé « d » déjà calculé (le calcul est
//   long ; le zoom, lui, passe par transform et ne change pas les tracés)
//   et son rectangle englobant « box » (voir inBox).
const countries = feature(world, world.objects.countries)
const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: 'Sphere' })
const path = geoPath(projection)
const SPHERE = path({ type: 'Sphere' }) // contour ovale du globe
const shapes = countries.features.map((country) => ({
  key: country.properties.name, // nom unique pour chaque pays
  country,
  d: path(country),
  // [[ouest, sud], [est, nord]] : longitudes et latitudes extrêmes du pays.
  box: geoBounds(country),
}))

// Le point [longitude, latitude] est-il dans le rectangle englobant du pays ?
// Test très rapide, fait avant geoContains (lent : il suit tout le contour).
// Mesuré sur 371 IP : 0,16 s au lieu de 4,7 s, mêmes résultats.
function inBox(box, longitude, latitude) {
  const west = box[0][0]
  const south = box[0][1]
  const east = box[1][0]
  const north = box[1][1]
  if (latitude < south || latitude > north) {
    return false
  }
  if (west <= east) {
    return longitude >= west && longitude <= east
  }
  // Pays à cheval sur la ligne de changement de date (Russie, Fidji…) :
  // ouest > est, le rectangle « fait le tour » par la longitude 180.
  return longitude >= west || longitude <= east
}

// Limite une valeur entre un minimum et un maximum.
function limit(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

// Vue de la carte : k = zoom (1 = monde entier), x et y = décalage.
// clamp empêche de zoomer trop ou de faire sortir la carte du cadre :
// zoomée k fois, la carte mesure WIDTH * k de large, donc x va de
// WIDTH - WIDTH * k (bord droit collé) à 0 (bord gauche collé). Pareil pour y.
function clamp(view) {
  const k = limit(view.k, 1, MAX_ZOOM)
  return {
    k,
    x: limit(view.x, WIDTH - WIDTH * k, 0),
    y: limit(view.y, HEIGHT - HEIGHT * k, 0),
  }
}

// Zoom de « factor » autour du point (px, py) du dessin. Le décalage
// grandit dans la même proportion que le zoom : le point sous la souris
// reste sous la souris.
function zoomAt(view, factor, px, py) {
  const k = limit(view.k * factor, 1, MAX_ZOOM)
  const ratio = k / view.k
  return clamp({
    k,
    x: px - (px - view.x) * ratio,
    y: py - (py - view.y) * ratio,
  })
}

// Position de la souris → coordonnées du dessin (960 × 480), quelle que
// soit la taille réelle de la carte à l'écran.
function toDrawing(svg, event) {
  const box = svg.getBoundingClientRect()
  const x = ((event.clientX - box.left) * WIDTH) / box.width
  const y = ((event.clientY - box.top) * HEIGHT) / box.height
  return [x, y]
}

// Ligne d'une IP dans l'infobulle : « 7 échecs, Guangzhou ». On ajoute le
// pays s'il diffère du titre de l'infobulle (titre = pays de la 1re IP).
function tooltipPlace(ip, firstIp) {
  let text = ip.failures + ' échecs'
  if (ip.geo.city) {
    text += ', ' + ip.geo.city
  }
  if (ip.geo.country_code !== firstIp.geo.country_code) {
    text += ', ' + countryName(ip.geo)
  }
  return text
}

// Carte du monde : pays d'origine coloriés et un point par IP suspecte,
// de la couleur de sa gravité. On peut zoomer et déplacer la carte ; le
// survol d'un pays attaquant (ou d'un point) affiche ses IP.
export default function WorldMap({ suspects }) {
  // Seules les IP avec des coordonnées peuvent être placées.
  // useMemo : recalculé seulement quand la liste d'IP change, pas à chaque
  // mouvement de la carte (sinon le glisser saccaderait).
  const located = useMemo(
    () => suspects.filter((s) => s.geo && s.geo.latitude !== null),
    [suspects],
  )

  // ipsByCountry[i] = les IP dont le point tombe dans le pays shapes[i].
  // inBox écarte vite les pays trop loin ; geoContains(pays, [longitude,
  // latitude]) fait ensuite le test exact.
  const ipsByCountry = useMemo(
    () => shapes.map((shape) => (
      located.filter((s) => (
        inBox(shape.box, s.geo.longitude, s.geo.latitude)
        && geoContains(shape.country, [s.geo.longitude, s.geo.latitude])
      ))
    )),
    [located],
  )

  const [view, setView] = useState(START)
  // Infobulle affichée : { title, ips, x, y, flip } ou null.
  const [tooltip, setTooltip] = useState(null)
  // ref : accès direct aux éléments HTML (taille à l'écran, écouteurs).
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  // Glisser en cours : { clientX, clientY, view, active, moved } ou null.
  // - active : le bouton de la souris est enfoncé ;
  // - moved : la souris a bougé (c'était un glisser, pas un clic).
  // Une ref et pas un state : la changer ne doit pas redessiner la carte.
  const dragRef = useRef(null)

  // Molette = zoom. Écouteur ajouté à la main avec passive: false, sinon
  // le navigateur interdit preventDefault() et la page défilerait aussi.
  useEffect(() => {
    const svg = svgRef.current
    function onWheel(event) {
      event.preventDefault()
      const [px, py] = toDrawing(svg, event)
      // deltaY < 0 : molette vers le haut = zoom avant.
      const factor = event.deltaY < 0 ? 1.25 : 0.8
      setView((current) => zoomAt(current, factor, px, py))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    // Nettoyage quand le composant disparaît.
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  function handlePointerDown(event) {
    dragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      view,
      active: true,
      moved: false,
    }
  }

  function handlePointerMove(event) {
    const drag = dragRef.current
    if (drag === null || !drag.active) return
    // Déplacement de la souris, converti en unités du dessin.
    const box = svgRef.current.getBoundingClientRect()
    const dx = ((event.clientX - drag.clientX) * WIDTH) / box.width
    const dy = ((event.clientY - drag.clientY) * HEIGHT) / box.height
    // Au-delà de 3 unités, c'est un glisser et non un clic.
    if (Math.abs(dx) + Math.abs(dy) > 3) {
      drag.moved = true
      setTooltip(null)
      setView(clamp({ k: drag.view.k, x: drag.view.x + dx, y: drag.view.y + dy }))
    }
  }

  // On garde « moved » : le clic envoyé juste après un glisser sera ignoré.
  function handlePointerUp() {
    if (dragRef.current !== null) {
      dragRef.current.active = false
    }
  }

  // Affiche l'infobulle à côté de la souris (ou du doigt sur téléphone).
  // fromClick : un clic qui termine un glisser ne doit pas ouvrir l'infobulle.
  // useCallback : la même fonction à chaque affichage (elle n'utilise que
  // des refs), ce qui permet de mettre la couche des pays en cache plus bas.
  const showTooltip = useCallback((event, ips, fromClick = false) => {
    const drag = dragRef.current
    if (drag !== null && drag.moved) {
      if (drag.active) return // pendant un glisser
      if (fromClick) return // clic de fin de glisser
    }
    const box = containerRef.current.getBoundingClientRect()
    const x = event.clientX - box.left
    setTooltip({
      title: countryName(ips[0].geo),
      ips,
      x,
      y: event.clientY - box.top,
      flip: x > box.width - 300, // trop à droite : l'infobulle passe à gauche
    })
  }, [])

  // Couche des pays, en cache : pendant un zoom ou un glisser, seul le
  // transform du <g> change, React n'a pas à recomparer les 240 pays.
  const countryLayer = useMemo(() => shapes.map((shape, index) => {
    const ips = ipsByCountry[index]
    if (ips.length === 0) {
      return <path key={shape.key} d={shape.d} className="map-country" />
    }
    // Pays attaquant : colorié et survolable.
    return (
      <path
        key={shape.key}
        d={shape.d}
        className={`map-country map-country-${worstSeverity(ips)}`}
        onMouseMove={(event) => showTooltip(event, ips)}
        onClick={(event) => showTooltip(event, ips, true)}
        onMouseLeave={() => setTooltip(null)}
      />
    )
  }), [ipsByCountry, showTooltip])

  // Points : les plus gros d'abord, les plus petits ensuite (dessinés
  // par-dessus, ils restent visibles). [...located] fait une copie :
  // sort() ne doit pas modifier la liste d'origine.
  const sortedPoints = [...located].sort((a, b) => b.failures - a.failures)

  // Boutons : zoom autour du centre de la carte.
  function zoomButton(factor) {
    setTooltip(null)
    setView((current) => zoomAt(current, factor, WIDTH / 2, HEIGHT / 2))
  }

  function handleDoubleClick(event) {
    const [px, py] = toDrawing(svgRef.current, event)
    setView((current) => zoomAt(current, 2, px, py))
  }

  function handlePointerLeave() {
    handlePointerUp()
    setTooltip(null)
  }

  return (
    <div className="map" ref={containerRef}>
      <div className="map-controls">
        <button type="button" className="button-secondary" onClick={() => zoomButton(1.5)} aria-label="Zoom avant">+</button>
        <button type="button" className="button-secondary" onClick={() => zoomButton(1 / 1.5)} aria-label="Zoom arrière">−</button>
        <button type="button" className="button-secondary" onClick={() => setView(START)} disabled={view.k === 1}>
          Recentrer
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Carte du monde : ${located.length} IP suspectes localisées`}
        className={view.k > 1 ? 'map-zoomed' : ''}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={handleDoubleClick}
      >
        {/* Tout ce qui est dans ce <g> suit le zoom et le déplacement. */}
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <path d={SPHERE} className="map-sphere" />
          {countryLayer}
          {sortedPoints.map((s) => {
            const [x, y] = projection([s.geo.longitude, s.geo.latitude])
            // Racine carrée : la surface du point suit le nombre d'échecs.
            // Divisé par le zoom : le point garde la même taille à l'écran.
            const radius = (4 + Math.sqrt(s.failures) * 1.2) / view.k
            // Survol d'un point : les IP du même pays que ce point.
            const sameCountry = located.filter((o) => o.geo.country_code === s.geo.country_code)
            return (
              <g
                key={s.ip}
                className={`map-dot map-dot-${s.severity}`}
                onMouseMove={(event) => showTooltip(event, sameCountry)}
                onClick={(event) => showTooltip(event, sameCountry, true)}
              >
                {/* Onde animée seulement pour les IP critiques (CSS). */}
                {s.severity === 'critique' && <circle cx={x} cy={y} r={radius} className="map-pulse" />}
                <circle cx={x} cy={y} r={radius} />
              </g>
            )
          })}
        </g>
      </svg>

      {tooltip !== null && (
        <div
          className={tooltip.flip ? 'map-tooltip map-tooltip-flip' : 'map-tooltip'}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <strong>{tooltip.title}</strong>
          <span className="muted">
            {tooltip.ips.length} IP, {totalFailures(tooltip.ips)} échecs
          </span>
          <ul>
            {tooltip.ips.map((s) => (
              <li key={s.ip}>
                <span className="mono">{s.ip}</span>
                <SeverityBadge severity={s.severity} />
                <span className="muted tooltip-place">{tooltipPlace(s, tooltip.ips[0])}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="map-legend">
        <li><span className="swatch swatch-critique" />Critique</li>
        <li><span className="swatch swatch-elevee" />Élevée</li>
        <li><span className="swatch swatch-moyenne" />Moyenne</li>
        <li className="muted">Pays colorié : gravité la plus haute de ses IP.</li>
      </ul>
      {located.length < suspects.length && (
        <p className="muted map-note">
          {suspects.length - located.length} IP non placées (réseau privé, adresse de
          documentation ou base de géolocalisation non installée).
        </p>
      )}
    </div>
  )
}
