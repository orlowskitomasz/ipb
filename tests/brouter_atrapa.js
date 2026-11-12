// Atrapa serwera tras do testów: z adresu zapytania BRoutera robi odpowiedź o znanych własnościach.
// Długość ≈ 1,3 × obwód punktów, ślepa odnoga 150 m przy drugim punkcie, przejścia co kilka odcinków, para oznaczeń bliżej niż 30 m.
// Start powyżej 60° szerokości: tekst błędu zamiast trasy. Użycie: require(...)(url) albo node brouter_atrapa.js URL
const RAD = Math.PI / 180;
const odl = (a, b) => { const x = (b[0] - a[0]) * RAD * Math.cos((a[1] + b[1]) / 2 * RAD), y = (b[1] - a[1]) * RAD; return Math.hypot(x, y) * 6371000; };
function atrapa(url) {
  const wp = decodeURIComponent(new URL(url).searchParams.get('lonlats')).split('|').map((p) => p.split(',').map(Number));
  if (wp[0][1] > 60) return 'target island detected for section 0';
  const pts = [];
  const odcinek = (a, b) => { const n = Math.max(2, Math.round(odl(a, b) / 20)); for (let i = pts.length ? 1 : 0; i <= n; i++) pts.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); };
  for (let i = 0; i < wp.length - 1; i++) {
    const a = wp[i], b = wp[i + 1], sr = [(a[0] + b[0]) / 2 - (b[1] - a[1]) * 0.42 / Math.cos(a[1] * RAD), (a[1] + b[1]) / 2 + (b[0] - a[0]) * 0.42 * Math.cos(a[1] * RAD)];
    odcinek(a, sr); odcinek(sr, b);
    if (i === 0 && wp.length > 3) { const k = [b[0], b[1] + 150 / 111320]; odcinek(b, k); odcinek(k, b); }
  }
  const coords = pts.map((p, i) => [p[0], p[1], 100 + 5 * Math.sin(i / 10)]);
  const wiersze = [['Longitude', 'Latitude', 'Elevation', 'Distance', 'CostPerKm', 'ElevCost', 'TurnCost', 'NodeCost', 'InitialCost', 'WayTags', 'NodeTags', 'Time', 'Energy']];
  let dl = 0, odTu = 0, nr = 0;
  const wiersz = (i, d, way, node) => wiersze.push([String(Math.round(pts[i][0] * 1e6)), String(Math.round(pts[i][1] * 1e6)), '100', String(Math.round(d)), '1000', '0', '0', '0', '0', way, node, '0', '0']);
  for (let i = 1; i < pts.length; i++) {
    dl += odl(pts[i - 1], pts[i]);
    if (dl - odTu >= 500 || i === pts.length - 1) {
      nr++;
      wiersz(i, dl - odTu, nr % 4 === 0 ? 'highway=residential estimated_town_class=5 estimated_forest_class=0' : 'highway=footway estimated_forest_class=4 estimated_town_class=1', nr % 3 === 0 ? 'highway=crossing' : '');
      odTu = dl;
      if (nr === 3 && i + 1 < pts.length - 1) { i++; const d = odl(pts[i - 1], pts[i]); dl += d; wiersz(i, d, 'highway=footway estimated_forest_class=4', 'highway=traffic_signals'); odTu = dl; }
    }
  }
  return JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { 'track-length': String(Math.round(dl)), messages: wiersze }, geometry: { type: 'LineString', coordinates: coords } }] });
}
if (require.main === module) process.stdout.write(atrapa(process.argv[2])); else module.exports = atrapa;
