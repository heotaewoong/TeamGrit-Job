import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCouponOrder,
  CouponNotFoundError,
  CouponNotApplicableError,
  type CouponRepository,
  type PaymentGateway,
  type OrderRepository,
  type Order,
} from "./createCouponOrder";
import type { Coupon } from "../domain/coupon";

// ── 가짜 객체(Mockito 대응: vi.fn())를 어디에, 왜 끼웠는가 ───────────────
// A-2에서 세운 기준: "HeoBrain이 직접 책임지는 쿠폰·금액·주문 상태·다운로드
// 권한 규칙은 실제 코드로 테스트하고, DB·결제사·파일 저장소처럼 서비스
// 밖에 있는 대상만 가짜로 대체한다."
//
// 이 테스트에서 Mock 하는 것 = couponRepository, paymentGateway, orderRepository
//   이유: 셋 다 네트워크/DB I/O를 수반하는 "외부 협력자"이고, 실제로 호출하면
//   느리거나(Independent/Fast 위반) 비용·데이터 변경이 생긴다(Repeatable 위반).
// 이 테스트에서 Mock 하지 않는 것 = calculateCouponDiscount (실제 함수 그대로 사용)
//   이유: 할인 계산은 HeoBrain이 직접 책임지는 핵심 규칙이다. 이걸 Mock으로
//   감싸면 "할인율을 잘못 계산해도 테스트가 통과하는" 신뢰할 수 없는 테스트가
//   된다 (A-2 예시와 동일한 함정).

const OPIC_BUNDLE = { code: "OPIC_BUNDLE", price: 9_900 };

function validCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    code: "TEST10",
    type: "PERCENTAGE",
    value: 10,
    minOrderAmount: 0,
    expiresAt: new Date("2999-01-01T00:00:00Z"),
    isActive: true,
    ...overrides,
  };
}

describe("createCouponOrder (외부 의존성을 Mock으로 격리한 서비스 테스트)", () => {
  let couponRepository: CouponRepository;
  let paymentGateway: PaymentGateway;
  let orderRepository: OrderRepository;

  beforeEach(() => {
    // Mockito의 @Mock 애노테이션에 대응: 인터페이스를 구현하는 가짜 객체를
    // vi.fn()으로 생성한다. 기본 동작은 각 테스트 안에서 mockResolvedValue 등으로 설정한다.
    couponRepository = { findByCode: vi.fn() };
    paymentGateway = { requestPayment: vi.fn() };
    orderRepository = {
      save: vi.fn(async (order: Order) => order), // 저장 후 그대로 반환하는 기본 Stub
    };
  });

  it("쿠폰이 없으면(couponCode 미입력) 결제 요청 금액은 정가 그대로다", async () => {
    vi.mocked(paymentGateway.requestPayment).mockResolvedValue({
      approved: true,
      approvedAmount: OPIC_BUNDLE.price,
    });

    const order = await createCouponOrder({
      orderId: "order-1",
      productCode: OPIC_BUNDLE.code,
      productPrice: OPIC_BUNDLE.price,
      couponRepository,
      paymentGateway,
      orderRepository,
    });

    expect(paymentGateway.requestPayment).toHaveBeenCalledWith({
      orderId: "order-1",
      amount: OPIC_BUNDLE.price,
    });
    expect(order.status).toBe("PAID");
    expect(order.downloadGranted).toBe(true);
  });

  it("존재하지 않는 쿠폰 코드면 결제 API를 호출하지 않고 즉시 실패한다", async () => {
    vi.mocked(couponRepository.findByCode).mockResolvedValue(null);

    await expect(
      createCouponOrder({
        orderId: "order-2",
        productCode: OPIC_BUNDLE.code,
        productPrice: OPIC_BUNDLE.price,
        couponCode: "NOT_EXIST",
        couponRepository,
        paymentGateway,
        orderRepository,
      })
    ).rejects.toThrow(CouponNotFoundError);

    // 행위 검증(런던파 스타일): 결제사에 아예 요청이 가지 않았어야 한다.
    expect(paymentGateway.requestPayment).not.toHaveBeenCalled();
    expect(orderRepository.save).not.toHaveBeenCalled();
  });

  it("만료/최소주문금액 미달 등 유효하지 않은 쿠폰이면 결제 API를 호출하지 않는다", async () => {
    vi.mocked(couponRepository.findByCode).mockResolvedValue(
      validCoupon({ expiresAt: new Date("2020-01-01T00:00:00Z") })
    );

    await expect(
      createCouponOrder({
        orderId: "order-3",
        productCode: OPIC_BUNDLE.code,
        productPrice: OPIC_BUNDLE.price,
        couponCode: "EXPIRED10",
        now: new Date("2026-08-16T00:00:00Z"),
        couponRepository,
        paymentGateway,
        orderRepository,
      })
    ).rejects.toThrow(CouponNotApplicableError);

    expect(paymentGateway.requestPayment).not.toHaveBeenCalled();
    expect(orderRepository.save).not.toHaveBeenCalled();
  });

  it("서버가 계산한 결제 예정 금액과 PG 승인 금액이 다르면 주문을 PAID로 바꾸지 않는다", async () => {
    vi.mocked(couponRepository.findByCode).mockResolvedValue(
      validCoupon({ type: "PERCENTAGE", value: 10 })
    );
    // 서버 계산: 9,900 - 990 = 8,910원이어야 하는데, PG가 다른 금액을 승인했다고 응답.
    vi.mocked(paymentGateway.requestPayment).mockResolvedValue({
      approved: true,
      approvedAmount: 9_900, // 할인 미반영된 금액 (조작/오류 상황 재현)
    });

    const order = await createCouponOrder({
      orderId: "order-4",
      productCode: OPIC_BUNDLE.code,
      productPrice: OPIC_BUNDLE.price,
      couponCode: "TEST10",
      couponRepository,
      paymentGateway,
      orderRepository,
    });

    expect(order.status).toBe("FAILED");
    expect(order.downloadGranted).toBe(false);
    expect(orderRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "FAILED", downloadGranted: false })
    );
  });

  it("결제가 성공하면 주문이 PAID로 저장되고 다운로드 권한이 부여된다", async () => {
    vi.mocked(couponRepository.findByCode).mockResolvedValue(
      validCoupon({ type: "PERCENTAGE", value: 10 })
    );
    vi.mocked(paymentGateway.requestPayment).mockResolvedValue({
      approved: true,
      approvedAmount: 8_910,
    });

    const order = await createCouponOrder({
      orderId: "order-5",
      productCode: OPIC_BUNDLE.code,
      productPrice: OPIC_BUNDLE.price,
      couponCode: "TEST10",
      couponRepository,
      paymentGateway,
      orderRepository,
    });

    expect(order.discountAmount).toBe(990);
    expect(order.finalAmount).toBe(8_910);
    expect(order.status).toBe("PAID");
    expect(order.downloadGranted).toBe(true);
    expect(orderRepository.save).toHaveBeenCalledTimes(1);
  });

  it("결제가 승인 거절(approved:false)되면 다운로드 권한이 생성되지 않는다", async () => {
    vi.mocked(couponRepository.findByCode).mockResolvedValue(
      validCoupon({ type: "PERCENTAGE", value: 10 })
    );
    vi.mocked(paymentGateway.requestPayment).mockResolvedValue({
      approved: false,
      approvedAmount: 0,
    });

    const order = await createCouponOrder({
      orderId: "order-6",
      productCode: OPIC_BUNDLE.code,
      productPrice: OPIC_BUNDLE.price,
      couponCode: "TEST10",
      couponRepository,
      paymentGateway,
      orderRepository,
    });

    expect(order.status).toBe("FAILED");
    expect(order.downloadGranted).toBe(false);
  });
});
