export default function ExchPill({ exch }) {
  const cls = exch === 'AU' ? 'pill pill-au' : exch === 'US' ? 'pill pill-us' : 'pill pill-eu'
  return <span className={cls}>{exch}</span>
}
