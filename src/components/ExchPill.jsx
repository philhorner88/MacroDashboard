export default function ExchPill({ exch }) {
  if (exch === 'AU') return <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#FF9F43]/10 text-[#FF9F43] font-black uppercase">AU</span>
  if (exch === 'US') return <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#4F8EF7]/10 text-[#4F8EF7] font-black uppercase">US</span>
  return <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#B76DFF]/10 text-[#B76DFF] font-black uppercase">EU</span>
}
