import { useState } from 'react'
import { Modal } from '../../../components/shared/Feedback'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
const PRICING_PLANS = [
  {
    name: 'GÓI CƠ BẢN',
    price: 'Miễn phí',
    period: '/ MVP',
    description: 'Ghép bạn học và tổ chức các phiên học cùng nhau trong bản MVP.',
    features: ['Matching theo hồ sơ học tập', 'Phòng học Pomodoro 25/50 phút'],
    cta: 'Gói hiện tại',
  },
  {
    name: 'PASS MÙA THI (SPRINT)',
    price: 'Chưa mở',
    period: '',
    description: 'Gói theo mùa thi chưa được phát hành.',
    features: ['Chưa công bố quyền lợi', 'Chưa mở thanh toán'],
    badge: 'CẤP TỐC MÙA THI',
    cta: 'Chọn gói Sprint',
  },
  {
    name: 'STUDYMATCH PLUS',
    price: 'Chưa mở',
    period: '',
    description: 'Gói mở rộng chưa được phát hành.',
    features: ['Chưa công bố quyền lợi', 'Chưa mở thanh toán'],
    badge: 'KHUYÊN DÙNG NHẤT',
    featured: true,
    cta: 'Chọn StudyMatch Plus',
  },
]

export function PricingPage() {
  const [metrics, setMetrics] = useState(false)
  const { say, data } = useWorkspace()
  const choose = () => say('MVP hiện chưa mở đăng ký gói trả phí.')
  return (
    <div className="space-y-6 text-[#2C221E]">
      <section
        className="rounded-2xl border border-[#E2DDD5] p-7 overflow-hidden relative"
        style={{ background: 'linear-gradient(130deg,#EFECE6 0%,#F9F6F0 52%,#E7EFE8 100%)' }}
      >
        <div className="absolute -right-20 -top-24 w-64 h-64 rounded-full bg-[#A7B99A]/20" />
        <div className="relative grid lg:grid-cols-[3fr_2fr] gap-7 items-center">
          <div>
            <span className="inline-flex rounded-full bg-[#FDF2F2] text-[#C53030] px-3 py-1.5 text-xs font-semibold">
              Học tốt hơn, cùng nhau
            </span>
            <h1 className="mt-4 text-2xl font-extrabold leading-[1.4] tracking-[-0.02em]">
              Một góc học tập ấm áp, một người bạn đồng hành <span className="text-[#2D5A43]">phù hợp</span>.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#5C534E]">
              StudyMatch MVP hiện miễn phí. Các gói trả phí chưa được phát hành; không có giới hạn hoặc giao
              dịch được mô phỏng.
            </p>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
            <div className="rounded-xl border border-[#FEB2B2] bg-[#FFF5F5] p-4 text-center flex flex-col justify-center">
              <p className="text-[10px] font-bold tracking-wide text-[#9B2C2C]">BUỔI HỌC HOÀN THÀNH</p>
              <strong className="text-[22px] text-[#C53030] mt-1">
                {data?.progress.completedSessions ?? 0}
              </strong>
              <p className="text-[11px] text-[#7B4545] mt-1">Từ những phiên học thực tế</p>
            </div>
            <span className="self-center text-xs font-extrabold text-[#8C827C]">VS</span>
            <div className="rounded-xl border border-[#86EFAC] bg-[#F0FDF4] p-4 text-center flex flex-col justify-center">
              <p className="text-[10px] font-bold tracking-wide text-[#2D5A43]">✨ MỤC TIÊU HOÀN THÀNH</p>
              <strong className="text-[22px] text-[#2D5A43] mt-1">
                {data?.progress.completedGoals ?? 0}
              </strong>
              <p className="text-[11px] text-[#47745E] mt-1">Từng bước tiến nhỏ mỗi ngày</p>
            </div>
          </div>
        </div>
      </section>

      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-extrabold">Tiến độ &amp; Gói học tập</h2>
          <p className="mt-1 text-[13px] text-[#746A64]">Thông tin gói và hành trình học tập của bạn</p>
        </div>
        <button className="btn btn-o text-xs" onClick={() => setMetrics(true)}>
          ✨ Tiến độ học tập
        </button>
      </header>

      <div className="grid lg:grid-cols-3 gap-5 items-stretch">
        {PRICING_PLANS.map((plan) => (
          <article
            key={plan.name}
            className={`relative rounded-2xl bg-white p-6 flex flex-col border ${plan.featured ? 'border-2 border-[#2D5A43] shadow-[0_18px_40px_-24px_rgba(45,90,67,.45)]' : 'border-[#E2DDD5] shadow-[0_12px_30px_-24px_rgba(44,34,30,.28)]'}`}
          >
            {plan.badge && (
              <span
                className={`absolute -top-3 left-6 rounded-full px-3 py-1 text-[10px] font-bold tracking-wide ${plan.featured ? 'bg-[#2D5A43] text-white' : 'bg-[#F5D8A8] text-[#70491F]'}`}
              >
                {plan.badge}
              </span>
            )}
            <p className="text-xs font-extrabold tracking-[.08em] text-[#5C534E]">{plan.name}</p>
            <div className="flex items-end gap-2 mt-5">
              <strong className="text-[28px] leading-none text-[#2D5A43]">{plan.price}</strong>
              <span className="text-xs text-[#746A64]">{plan.period}</span>
            </div>
            <p className="text-sm leading-6 text-[#5C534E] mt-5 min-h-18">{plan.description}</p>
            <div className="h-px bg-[#EEEAE3] my-5" />
            <ul className="space-y-3 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-sm leading-5">
                  <span className="w-5 h-5 rounded-full bg-[#E7F0E9] text-[#2D5A43] grid place-items-center shrink-0 text-xs font-bold">
                    ✓
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              disabled
              onClick={() => choose()}
              className={`mt-6 h-11 rounded-full text-sm font-semibold transition disabled:cursor-default ${plan.featured ? 'bg-[#2D5A43] text-white hover:bg-[#244936]' : plan.name === 'GÓI CƠ BẢN' ? 'bg-[#EFECE6] text-[#746A64]' : 'border border-[#2D5A43] text-[#2D5A43] hover:bg-[#F0F7F2]'}`}
            >
              {plan.name === 'GÓI CƠ BẢN' ? 'Gói hiện tại' : 'Chưa mở đăng ký'}
            </button>
          </article>
        ))}
      </div>

      {metrics && (
        <Modal onClose={() => setMetrics(false)}>
          <h3 className="text-lg font-extrabold">Tiến độ học tập</h3>
          <p className="text-sm text-[#746A64] mt-1">Số liệu được tính từ những buổi học đã hoàn thành.</p>
          <div className="grid grid-cols-3 gap-2 my-5">
            {[
              [String(data?.progress.completedSessions ?? 0), 'Buổi học'],
              [String(data?.progress.partnerCount ?? 0), 'Bạn học'],
              [String(data?.progress.completedGoals ?? 0), 'Mục tiêu'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl bg-[#F9F6F0] p-3 text-center">
                <strong className="block text-xl text-[#2D5A43]">{v}</strong>
                <span className="text-[10px] text-[#746A64]">{l}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-p w-full" onClick={() => setMetrics(false)}>
            Đóng báo cáo
          </button>
        </Modal>
      )}
    </div>
  )
}
