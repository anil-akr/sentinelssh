import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

// Mêmes couleurs que les pastilles de gravité (styles.css).
const COLORS = { moyenne: '#ffe414', elevee: '#ff7a00', critique: '#ff3344' }

// Couleurs du thème sombre pour les axes et l'infobulle.
const AXIS = { fontSize: 12, fill: '#8fa1ba' }

// Graphique en barres : les 10 IP avec le plus d'échecs.
export default function TopIpsChart({ suspects }) {
  // Copie avant le tri : on ne modifie jamais une prop.
  const top10 = [...suspects]
    .sort((a, b) => b.failures - a.failures)
    .slice(0, 10)

  return (
    <div
      className="chart"
      role="img"
      aria-label="Graphique en barres du nombre d'échecs par IP"
      style={{ height: 40 * top10.length + 60 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {/* layout="vertical" : barres horizontales, IP lisibles à gauche. */}
        <BarChart data={top10} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid stroke="#22324a" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={AXIS} stroke="#2c3d58" />
          <YAxis
            type="category"
            dataKey="ip"
            width={140}
            tick={{ ...AXIS, fill: '#d5deea', fontFamily: 'IBM Plex Mono, monospace' }}
            stroke="#2c3d58"
          />
          <Tooltip
            formatter={(value) => [value, 'Échecs']}
            cursor={{ fill: '#ffffff', fillOpacity: 0.04 }}
            contentStyle={{ background: '#16233a', border: '1px solid #2c3d58', borderRadius: 8 }}
            labelStyle={{ color: '#e8eef7' }}
            itemStyle={{ color: '#e8eef7' }}
          />
          <Bar dataKey="failures" radius={[0, 4, 4, 0]} barSize={20}>
            {/* Cell : une couleur par barre, celle de la gravité de l'IP. */}
            {top10.map((s) => (
              <Cell key={s.ip} fill={COLORS[s.severity]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
