import {
  calculateCouponDiscount,
  type Coupon,
} from "../domain/coupon";

// ── 외부 의존성 인터페이스 ─────────────────────────────────────────────
// 이 세 가지는 전부 HeoBrain 서비스 "바깥"에 있는 협력자다.
// - CouponRepository: Supabase에서 쿠폰을 조회한다 (DB I/O)
// - PaymentGateway:   PortOne/NHN KCP 결제 승인을 요청한다 (외부 API, 실제 비용 발생)
// - OrderRepository:  Supabase에 주문을 저장한다 (DB I/O)
// A-2에서 세운 기준: "HeoBrain이 직접 책임지는 규칙(할인 계산)은 실제 코드로,
// 서비스 밖에 있는 대상(DB·결제사)만 가짜로 대체한다." 이 세 인터페이스가 바로
// 그 "서비스 밖" 경계이므로 테스트에서 Mockito(vi.fn()) 대상이 된다.
export interface CouponRepository {
  findByCode(code: string): Promise<Coupon | null>;
}

export interface PaymentRequest {
  orderId: string;
  amount: number;
}

export interface PaymentResult {
  approved: boolean;
  approvedAmount: number;
}

export interface PaymentGateway {
  requestPayment(request: PaymentRequest): Promise<PaymentResult>;
}

export type OrderStatus = "PAID" | "FAILED";

export interface Order {
  id: string;
  productCode: string;
  productPrice: number;
  couponCode?: string;
  discountAmount: number;
  finalAmount: number;
  status: OrderStatus;
  downloadGranted: boolean;
}

export interface OrderRepository {
  save(order: Order): Promise<Order>;
}

export class CouponNotFoundError extends Error {
  constructor(code: string) {
    super(`Coupon not found: ${code}`);
    this.name = "CouponNotFoundError";
  }
}

export class CouponNotApplicableError extends Error {
  constructor(public readonly reason: string) {
    super(`Coupon not applicable: ${reason}`);
    this.name = "CouponNotApplicableError";
  }
}

export interface CreateCouponOrderParams {
  orderId: string;
  productCode: string;
  productPrice: number;
  couponCode?: string;
  now?: Date;
  couponRepository: CouponRepository;
  paymentGateway: PaymentGateway;
  orderRepository: OrderRepository;
}

/**
 * 쿠폰 적용 주문 결제 흐름.
 * 1) 쿠폰 코드가 있으면 조회 후 유효성 검증 (순수 로직: calculateCouponDiscount)
 * 2) 유효하지 않으면 결제 API를 호출하지 않고 즉시 실패시킨다.
 * 3) 결제를 요청하고, 승인 금액이 서버 계산 금액과 일치할 때만 PAID + 다운로드 권한 부여.
 */
export async function createCouponOrder(
  params: CreateCouponOrderParams
): Promise<Order> {
  const {
    orderId,
    productCode,
    productPrice,
    couponCode,
    now,
    couponRepository,
    paymentGateway,
    orderRepository,
  } = params;

  let discountAmount = 0;
  let finalAmount = productPrice;

  if (couponCode) {
    const coupon = await couponRepository.findByCode(couponCode);
    if (!coupon) {
      // 쿠폰이 없으면 결제 API를 아예 호출하지 않는다 (A-2: 외부 결제 호출은 비용이 드는 부수효과).
      throw new CouponNotFoundError(couponCode);
    }

    // 할인 규칙 자체는 Mock하지 않는다. 실제 함수를 그대로 호출해야
    // 할인 계산 결함(예: 경계값 부등호 오류)을 이 테스트가 잡아낼 수 있다.
    const discountResult = calculateCouponDiscount({
      productCode,
      productPrice,
      coupon,
      now,
    });

    if (!discountResult.isApplied) {
      throw new CouponNotApplicableError(
        discountResult.rejectionReason ?? "UNKNOWN"
      );
    }

    discountAmount = discountResult.discountAmount;
    finalAmount = discountResult.finalAmount;
  }

  const paymentResult = await paymentGateway.requestPayment({
    orderId,
    amount: finalAmount,
  });

  const paymentIsValid =
    paymentResult.approved && paymentResult.approvedAmount === finalAmount;

  const order: Order = {
    id: orderId,
    productCode,
    productPrice,
    couponCode,
    discountAmount,
    finalAmount,
    status: paymentIsValid ? "PAID" : "FAILED",
    downloadGranted: paymentIsValid,
  };

  return orderRepository.save(order);
}
