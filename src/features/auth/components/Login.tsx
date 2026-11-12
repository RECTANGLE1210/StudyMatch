import { useEffect, useState, type ReactNode } from 'react'

const wavePath = (x0: number, amp: number, ph: number) => {
  let d = `M${x0} 0`
  for (let y = 0; y <= 640; y += 8)
    d += ` L${(x0 + amp * Math.sin((y / 640) * Math.PI * 7 + ph)).toFixed(1)} ${y}`
  return d + ' L150 640 L150 0 Z'
}
export function Login({ children }: { children: ReactNode }) {
  const [sc, setSc] = useState(1)
  // Always render the horizontal 1100x640 card; scale it down on smaller viewports instead of stacking.
  useEffect(() => {
    const fit = () => setSc(Math.min(1, (window.innerWidth - 24) / 1100, (window.innerHeight - 24) / 640))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  const glass =
    'rounded-2xl border border-white/80 bg-white/15 backdrop-blur-xl shadow-[0_16px_30px_-14px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.25)]'
  return (
    <div className="relative min-h-screen grid place-items-center overflow-hidden bg-[#EFECE6]">
      <div
        className="absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(167,185,154,.38), transparent 65%)' }}
      />
      <div
        className="absolute -bottom-48 -right-24 w-[620px] h-[620px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(216,156,87,.3), transparent 65%)' }}
      />
      <div className="relative" style={{ width: 1100 * sc, height: 640 * sc }}>
        <main
          className="absolute top-0 left-0 w-[1100px] h-[640px] flex flex-row overflow-hidden rounded-[32px] shadow-[0_2px_4px_rgba(53,39,33,.08),0_12px_24px_rgba(53,39,33,.12),0_40px_80px_-10px_rgba(53,39,33,.3),0_70px_120px_-30px_rgba(53,39,33,.3)]"
          style={{
            transform: `scale(${sc})`,
            transformOrigin: 'top left',
            background: 'linear-gradient(150deg,#3F5E4F 0%,#365C4A 45%,#2C4A3C 100%)',
          }}
        >
          {/* LEFT 52% */}
          <section className="relative w-[52%] h-full p-12 flex flex-col justify-between text-[#F8F5EE]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 backdrop-blur-md px-4 py-1.5 text-xs font-medium">
                🍵 Study Café &amp; Peer Learning
              </span>
              <h1 className="mt-5 text-[48px] leading-none font-extrabold tracking-[-0.02em]">StudyMatch</h1>
              <p className="mt-3 text-[15px] leading-[1.55] text-[#E6E0D3] max-w-[340px]">
                Một góc học tập ấm áp, một người bạn đồng hành phù hợp
              </p>
            </div>
            <div className="space-y-4 max-w-[340px]">
              <div className={`${glass} p-4 flex gap-3 items-center`}>
                <span className="w-10 h-10 rounded-xl bg-[#D89C57] grid place-items-center text-lg shrink-0">
                  🤝
                </span>
                <div>
                  <b className="text-sm block">Ghép đôi thông minh 1-1</b>
                  <span className="text-xs text-[#E6E0D3]/85">
                    Đồng bộ lịch rảnh, luyện giải đề cùng cạ cứng
                  </span>
                </div>
              </div>
              <div className={`${glass} p-4 flex gap-3 items-center`}>
                <span className="w-10 h-10 rounded-xl bg-[#A7B99A] grid place-items-center text-lg shrink-0">
                  🍅
                </span>
                <div>
                  <b className="text-sm block">Phòng học Pomodoro chung</b>
                  <span className="text-xs text-[#E6E0D3]/85">Kết hợp âm nhạc lofi thư giãn</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-[#E6E0D3]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D89C57] shadow-[0_0_0_4px_rgba(216,156,87,.22),0_0_14px_4px_rgba(216,156,87,.75)]" />
              Không gian học tập hàng đầu cho sinh viên Việt Nam
            </div>
          </section>

          {/* vertical wave divider at the 52% seam */}
          <svg
            className="absolute top-0 h-full w-[150px] left-[calc(52%-100px)]"
            viewBox="0 0 150 640"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path d={wavePath(24, 12, 0)} fill="#749F82" fillOpacity=".28" />
            <path d={wavePath(50, 10, 1.5)} fill="#749F82" fillOpacity=".75" />
            <path d={wavePath(78, 9, 2.8)} fill="#FAF7F2" />
          </svg>

          {/* RIGHT 48% */}
          <section className="absolute inset-y-0 right-0 w-[calc(48%-50px)] bg-[#FAF7F2] px-14 py-8 flex flex-col justify-center overflow-y-auto">
            {children}
          </section>
        </main>
      </div>
    </div>
  )
}
