import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function BookingFormPage() {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, getCartCount, clearCart } = useCart();
  const isNavigatingToSuccess = useRef(false);
  const apiBase =
    import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

  const [searchQuery, setSearchQuery] = useState("");
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [dateBooking, setDateBooking] = useState("");
  const [timeBooking, setTimeBooking] = useState("");
  const [note, setNote] = useState("");

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const totalPrice = getCartTotal();
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
    return appliedPromotions.map((promo) => {
      const treatments = Array.isArray(promo.treatments) ? promo.treatments : [];
      const items = treatments.map((t) => {
        const cartItem = cartById.get(t.treatment_id);
        return {
          ...t,
          price: cartItem?.price ?? t.price ?? 0,
        };
      });
      const originalTotal = items.reduce((sum, item) => sum + (item.price || 0), 0);
      const discountPercent = Number(promo.discount_percent || 0);
      const discountAmount = originalTotal * (discountPercent / 100);
      return { ...promo, discountAmount };
    });
  }, [appliedPromotions, cartById]);

  const totalDiscount = promotionTotals.reduce(
    (sum, promo) => sum + (promo.discountAmount || 0),
    0
  );
  const finalTotal = Math.max(0, totalPrice - totalDiscount);

  // Redirect to cart if empty (only if not navigating to success)
  useEffect(() => {
    if (cartItems.length === 0 && !isNavigatingToSuccess.current) {
      navigate("/cart");
    }
  }, [cartItems, navigate]);

  // Search customers when query changes
  useEffect(() => {
    const searchCustomers = async () => {
      if (!searchQuery || searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const response = await fetch(
          `http://localhost:8000/api/v1/resource/customer?query=${encodeURIComponent(searchQuery)}&limit=5`
        );
        const data = await response.json();
        setSuggestions(data.customers || []);
        setShowSuggestions(true);
      } catch (error) {
        console.error("Failed to search customers:", error);
        setSuggestions([]);
      }
    };

    const debounce = setTimeout(searchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSelectCustomer = (customer) => {
    setName(customer.full_name || "");
    setCustomerId(customer.customer_code || "");
    setSearchQuery(customer.full_name || customer.customer_code || "");
    setShowSuggestions(false);
    setIsNewCustomer(false);
  };

  const handleNewCustomer = () => {
    setName(searchQuery);
    setCustomerId("");
    setShowSuggestions(false);
    setIsNewCustomer(true);
  };

  const handlePayment = async () => {
    // Mark that we're navigating to success (to prevent redirect to cart)
    isNavigatingToSuccess.current = true;

    // Save cart data before clearing (to pass to success page)
    const treatmentsData = [...cartItems];
    const totalPriceData = finalTotal;

    const sessionDate = dateBooking || new Date().toISOString().slice(0, 10);
    const sessionTime = timeBooking || "10:00";

    const payload = {
      treatments: treatmentsData.map((item) => ({
        treatment_id: item.treatment_id,
        price: item.price || 0,
        quantity: item.quantity || 1,
      })),
      promotions: appliedPromotions.map((promo) => promo.promotion_id),
      customer_name: name || searchQuery || "Guest",
      customer_id: customerId || null,
      session_date: sessionDate,
      session_time: sessionTime,
      note: note || null,
      total_amount: totalPrice,
    };

    let invoiceNo = null;
    try {
      const response = await fetch(`${apiBase}/booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Booking failed");
      }
      invoiceNo = result.invoice_no ?? null;
    } catch (error) {
      isNavigatingToSuccess.current = false;
      alert(error.message || "Booking failed");
      return;
    }

    // Clear cart
    clearCart();

    // Navigate with saved data
    navigate("/success", {
      state: {
        treatments: treatmentsData,
        totalPrice: totalPriceData,
        originalTotal: totalPrice,
        discountTotal: totalDiscount,
        invoiceNo,
        booking: {
          name,
          customerId,
          dateBooking,
          timeBooking,
          note,
        },
      },
    });
  };

  if (cartItems.length === 0 && !isNavigatingToSuccess.current) {
    return null;
  }

  return (
    <section className="bg-[#E6D4B9] px-6 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[1000px]">
        <div className="mx-auto w-full max-w-205 bg-white py-5 text-center shadow-sm">
          <h2 className="font-luxury text-[26px] tracking-[0.12em] text-[#9b7a2f]">
            Booking
          </h2>
        </div>

        <div className="mx-auto -mt-6 rounded-2xl bg-[#f8efe7] px-8 pb-10 pt-12 sm:px-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
            <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
              {/* Customer Search */}
              <div className="relative mb-4">
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                  Search Customer (Name or ID)
                  <input
                    className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsNewCustomer(false);
                    }}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Type name or customer ID..."
                  />
                </label>

                {/* Suggestions dropdown */}
                {showSuggestions && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-black/10 bg-white shadow-lg">
                    {suggestions.length > 0 ? (
                      <>
                        {suggestions.map((customer) => (
                          <button
                            key={customer.customer_id}
                            type="button"
                            onClick={() => handleSelectCustomer(customer)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] hover:bg-[#f8efe7]"
                          >
                            <span className="font-semibold">{customer.full_name}</span>
                            <span className="text-black/50">{customer.customer_code}</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={handleNewCustomer}
                          className="flex w-full items-center px-3 py-2 text-left text-[12px] text-[#9b7a2f] hover:bg-[#f8efe7]"
                        >
                          + Create new customer "{searchQuery}"
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleNewCustomer}
                        className="flex w-full items-center px-3 py-2 text-left text-[12px] text-[#9b7a2f] hover:bg-[#f8efe7]"
                      >
                        + Create new customer "{searchQuery}"
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Customer Info */}
              {(name || isNewCustomer) && (
                <div className="mb-4 rounded-lg bg-[#e7efe4] px-3 py-2 text-[12px]">
                  <div className="font-semibold text-[#3f6b4c]">
                    {isNewCustomer ? "New Customer" : "Selected Customer"}
                  </div>
                  <div className="mt-1 text-black/70">
                    Name: <span className="font-semibold text-black">{name}</span>
                    {customerId && (
                      <span className="ml-3">
                        ID: <span className="font-semibold text-black">{customerId}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                  Date Booking
                  <input
                    type="date"
                    className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                    value={dateBooking}
                    onChange={(e) => setDateBooking(e.target.value)}
                  />
                </label>

                <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                  Time Booking
                  <input
                    type="time"
                    className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                    value={timeBooking}
                    onChange={(e) => setTimeBooking(e.target.value)}
                  />
                </label>
              </div>

              <label className="mt-5 flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                Information (Optional)
                <textarea
                  className="min-h-28 rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Please inform here"
                />
              </label>
            </div>

            {/* Summary */}
            <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-black/50">
                Order Summary
              </div>
              <div className="mt-2 text-[14px] font-semibold text-black">
                {getCartCount()} Treatment{getCartCount() > 1 ? "s" : ""}
              </div>

              <div className="mt-5 max-h-48 space-y-2 overflow-y-auto text-[12px] text-black/70">
                {cartItems.map((item) => (
                  <div key={item.treatment_id} className="flex items-center justify-between">
                    <span className="truncate pr-2">{item.name} x {item.quantity}</span>
                    <span className="font-semibold text-black">
                      THB {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {promotionTotals.length > 0 && (
                <div className="mt-4 rounded-xl border border-[#eadcc7] bg-[#fff7ee] px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b7a2f]">
                    Promotions Applied
                  </div>
                  <div className="mt-3 space-y-3">
                    {promotionTotals.map((promo) => (
                      <div key={`promo-${promo.promotion_id}`} className="text-[12px] text-black/70">
                        <div className="font-semibold text-black">
                          {promo.name || promo.code || "Promotion"}
                        </div>
                        <div className="mt-1 space-y-1 text-[12px] text-black/55">
                          {(promo.treatments || []).map((item) => (
                            <div key={item.treatment_id}>{item.name}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-2 border-t border-black/10 pt-4 text-[12px] text-black/70">
                {name && (
                  <div className="flex items-center justify-between">
                    <span>Customer</span>
                    <span className="font-semibold text-black">{name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[12px] text-black/60">Original Total</span>
                  <span className="text-[14px] font-semibold text-black">
                    THB {totalPrice.toLocaleString()}
                  </span>
                </div>
                {promotionTotals.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-black/60">Discount</span>
                    <span className="text-[14px] font-semibold text-[#9b7a2f]">
                      -THB {totalDiscount.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[14px] font-semibold">Total</span>
                  <span className="text-[18px] font-semibold text-[#9b7a2f]">
                    THB {finalTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePayment}
                disabled={!name || !dateBooking || !timeBooking}
                className="mt-6 h-11 w-full rounded-md bg-[#a39373] text-[12px] font-semibold uppercase tracking-[0.22em] text-black hover:bg-[#b4a279] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Payment
              </button>

              <button
                type="button"
                onClick={() => navigate("/cart")}
                className="mt-3 w-full text-center text-[12px] text-black/60 underline hover:text-black"
              >
                Back to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
