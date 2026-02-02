import { useEffect, useMemo, useState } from "react";
import { useCart } from "../context/CartContext";

export default function PromotionPage() {
  const apiBase =
    import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";
  const { addToCart, isInCart, getQuantity, incrementQuantity, decrementQuantity } =
    useCart();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetch(`${apiBase}/promotion/bundles`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load promotions");
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const items = Array.isArray(data?.promotions) ? data.promotions : [];
        setPromotions(items);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setPromotions([]);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [apiBase]);

  const displayPromotions = useMemo(() => promotions, [promotions]);

  const formatPrice = (value) => `THB ${Number(value || 0).toLocaleString()}`;

  const handleAdd = (promo) => {
    const treatments = Array.isArray(promo.treatments) ? promo.treatments : [];
    treatments.forEach((treatment) => {
      addToCart({
        treatment_id: treatment.treatment_id,
        name: treatment.name,
        description: treatment.description,
        category: treatment.category,
        price: treatment.price,
      });
    });
  };

  return (
    <section className="bg-[#f1e7da] px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <div className="relative z-10 mx-auto w-full max-w-205 bg-white py-5 text-center shadow-sm">
          <h2 className="font-luxury text-[26px] tracking-[0.12em] text-[#9b7a2f]">
            Promotion
          </h2>
        </div>

        <div className="mx-auto -mt-6 rounded-[28px] bg-[#f8efe7] px-6 pb-12 pt-10 sm:px-10">
          {loading ? (
            <div className="py-12 text-center text-[14px] text-black/50">
              Loading promotions...
            </div>
          ) : displayPromotions.length === 0 ? (
            <div className="py-12 text-center text-[14px] text-black/50">
              No promotions available
            </div>
          ) : (
            <div className="space-y-5">
              {displayPromotions.map((promo) => {
                const treatments = Array.isArray(promo.treatments) ? promo.treatments : [];
                const promoId = `PROMO-${promo.promotion_id}`;
                const inCart = treatments.every((t) => isInCart(t.treatment_id));
                const quantity = treatments.length
                  ? Math.min(...treatments.map((t) => getQuantity(t.treatment_id)))
                  : 0;
                const originalTotal = treatments.reduce(
                  (sum, item) => sum + (item.price || 0),
                  0
                );
                const discountPercent = Number(promo.discount_percent || 0);
                const discountedTotal =
                  originalTotal > 0
                    ? Math.max(0, originalTotal * (1 - discountPercent / 100))
                    : 0;
                return (
                  <div
                    key={promoId}
                    className="rounded-[20px] border border-black/5 bg-white px-6 py-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-[220px] flex-1">
                        <h3 className="font-luxury text-[20px] text-black">
                          {promo.name || promo.code || "Promotion"}
                        </h3>
                        <div className="mt-1 space-y-1 text-[12px] text-black/55">
                          {treatments.length ? (
                            treatments.map((item) => (
                              <div key={item.treatment_id}>{item.name}</div>
                            ))
                          ) : (
                            <div>Exclusive clinic offer</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-[12px] text-black/40 line-through">
                            {formatPrice(originalTotal)}
                          </div>
                          <div className="text-[14px] font-semibold text-[#9b7a2f]">
                            {formatPrice(discountedTotal)}
                          </div>
                        </div>

                        {inCart ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                treatments.forEach((item) =>
                                  decrementQuantity(item.treatment_id)
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-semibold">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                treatments.forEach((item) =>
                                  incrementQuantity(item.treatment_id)
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 hover:bg-green-200"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAdd(promo)}
                            className="rounded-lg bg-[#9b7a2f] px-5 py-2 text-[12px] font-semibold text-white transition-all hover:bg-[#7d6226]"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
