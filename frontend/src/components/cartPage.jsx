import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function CartPage() {
  const navigate = useNavigate();
  const apiBase =
    import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";
  const {
    cartItems,
    removeFromCart,
    getCartTotal,
    getCartCount,
    clearCart,
    incrementQuantity,
    decrementQuantity,
  } = useCart();
  const [promotionBundles, setPromotionBundles] = useState([]);

  useEffect(() => {
    let isMounted = true;
    fetch(`${apiBase}/promotion/bundles`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load promotions");
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setPromotionBundles(Array.isArray(data?.promotions) ? data.promotions : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setPromotionBundles([]);
      });

    return () => {
      isMounted = false;
    };
  }, [apiBase]);

  const cartById = useMemo(() => {
    const map = new Map();
    cartItems.forEach((item) => {
      map.set(item.treatment_id, item);
    });
    return map;
  }, [cartItems]);

  const appliedPromotions = useMemo(() => {
    const availability = new Map();
    cartItems.forEach((item) => {
      availability.set(item.treatment_id, item.quantity || 0);
    });

    const promos = [...promotionBundles].sort(
      (a, b) => (b.discount_percent || 0) - (a.discount_percent || 0)
    );

    const applied = [];
    promos.forEach((promo) => {
      const treatments = Array.isArray(promo.treatments) ? promo.treatments : [];
      if (!treatments.length) return;
      const canApply = treatments.every(
        (t) => (availability.get(t.treatment_id) || 0) > 0
      );
      if (!canApply) return;
      treatments.forEach((t) => {
        availability.set(t.treatment_id, (availability.get(t.treatment_id) || 0) - 1);
      });
      applied.push(promo);
    });

    return applied;
  }, [cartItems, promotionBundles]);

  const promotionTotals = useMemo(() => {
    const format = (promo) => {
      const treatments = Array.isArray(promo.treatments) ? promo.treatments : [];
      const items = treatments.map((t) => {
        const cartItem = cartById.get(t.treatment_id);
        return {
          ...t,
          name: cartItem?.name ?? t.name,
          price: cartItem?.price ?? t.price ?? 0,
        };
      });
      const originalTotal = items.reduce((sum, item) => sum + (item.price || 0), 0);
      const discountPercent = Number(promo.discount_percent || 0);
      const discountAmount = originalTotal * (discountPercent / 100);
      const discountedTotal = Math.max(0, originalTotal - discountAmount);
      return {
        ...promo,
        displayItems: items,
        originalTotal,
        discountedTotal,
        discountAmount,
      };
    };
    return appliedPromotions.map(format);
  }, [appliedPromotions, cartById]);

  const cartBaseTotal = getCartTotal();
  const totalDiscount = promotionTotals.reduce(
    (sum, promo) => sum + (promo.discountAmount || 0),
    0
  );
  const cartFinalTotal = Math.max(0, cartBaseTotal - totalDiscount);

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    navigate("/booking");
  };

  const handleContinueShopping = () => {
    navigate("/services");
  };

  return (
    <section className="bg-[#E6D4B9] px-6 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[1000px]">
        <div className="mx-auto w-full max-w-205 bg-white py-5 text-center shadow-sm">
          <h2 className="font-luxury text-[26px] tracking-[0.12em] text-[#9b7a2f]">
            Your Cart
          </h2>
        </div>

        <div className="mx-auto -mt-6 rounded-2xl bg-[#f8efe7] px-8 pb-10 pt-12 sm:px-12">
          {cartItems.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-[48px]">&#128722;</div>
              <p className="mt-4 text-[16px] text-black/60">Your cart is empty</p>
              <button
                type="button"
                onClick={handleContinueShopping}
                className="mt-6 rounded-md bg-[#9b7a2f] px-6 py-3 text-[14px] font-semibold text-white hover:bg-[#7d6226]"
              >
                Browse Services
              </button>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
              {/* Cart Items */}
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div
                    key={item.treatment_id}
                    className="rounded-2xl border border-black/10 bg-white px-6 py-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-luxury text-[18px] text-black">
                          {item.name}
                        </h3>
                        <p className="mt-1 text-[12px] text-black/50">
                          {item.category}
                        </p>
                        <p className="mt-1 text-[14px] font-semibold text-[#9b7a2f]">
                          THB {item.price?.toLocaleString()} x {item.quantity}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => decrementQuantity(item.treatment_id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-semibold">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => incrementQuantity(item.treatment_id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                          >
                            +
                          </button>
                        </div>
                        {/* Subtotal */}
                        <div className="text-[16px] font-semibold text-black">
                          THB {(item.price * item.quantity).toLocaleString()}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.treatment_id)}
                          className="text-[11px] text-red-500 underline hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {promotionTotals.length > 0 && (
                  <div className="rounded-2xl border border-[#eadcc7] bg-[#fff7ee] px-6 py-5 shadow-sm">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9b7a2f]">
                      Promotions Applied
                    </div>
                    <div className="mt-4 space-y-4">
                      {promotionTotals.map((promo) => (
                        <div
                          key={`promo-${promo.promotion_id}`}
                          className="rounded-xl border border-black/10 bg-white px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-[220px] flex-1">
                              <div className="font-luxury text-[16px] text-black">
                                {promo.name || promo.code || "Promotion"}
                              </div>
                              <div className="mt-1 space-y-1 text-[12px] text-black/60">
                                {promo.displayItems.map((t) => (
                                  <div key={t.treatment_id}>{t.name}</div>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[12px] text-black/40 line-through">
                                THB {promo.originalTotal.toLocaleString()}
                              </div>
                              <div className="text-[14px] font-semibold text-[#9b7a2f]">
                                THB {promo.discountedTotal.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clear Cart Button */}
                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={handleContinueShopping}
                    className="text-[12px] text-black/60 underline hover:text-black"
                  >
                    + Add more treatments
                  </button>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-[12px] text-red-500 underline hover:text-red-700"
                  >
                    Clear Cart
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
                <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-black/50">
                  Order Summary
                </div>

                <div className="mt-4 space-y-2 text-[12px] text-black/70">
                  {cartItems.map((item) => (
                    <div key={item.treatment_id} className="flex items-center justify-between">
                      <span className="truncate pr-2">
                        {item.name} x {item.quantity}
                      </span>
                      <span className="font-semibold text-black">
                        THB {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}

                  {promotionTotals.length > 0 && (
                    <div className="border-t border-black/10 pt-3 mt-3 space-y-2">
                      {promotionTotals.map((promo) => (
                        <div
                          key={`summary-${promo.promotion_id}`}
                          className="flex items-center justify-between text-[12px]"
                        >
                          <span className="truncate pr-2">
                            {promo.name || promo.code || "Promotion"}
                          </span>
                          <span className="font-semibold text-[#9b7a2f]">
                            -THB {promo.discountAmount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-black/10 pt-3 mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-black/60">Original Total</span>
                      <span className="text-[14px] font-semibold text-black">
                        THB {cartBaseTotal.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[14px] font-semibold">
                        Total ({getCartCount()} items)
                      </span>
                      <span className="text-[18px] font-semibold text-[#9b7a2f]">
                        THB {cartFinalTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  className="mt-6 h-11 w-full rounded-md bg-[#9b7a2f] text-[12px] font-semibold uppercase tracking-[0.22em] text-white hover:bg-[#7d6226]"
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
