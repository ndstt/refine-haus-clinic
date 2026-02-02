import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function CategoryDetailPage() {
  const { categoryKey } = useParams();
  const navigate = useNavigate();
  const { addToCart, isInCart, getCartCount, getQuantity, incrementQuantity, decrementQuantity } = useCart();

  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addedMessage, setAddedMessage] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  const apiBase =
    import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

  const slugify = (value) =>
    value
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const categoryTitle = useMemo(() => {
    if (!categoriesLoaded) return "";
    const match = categories.find(
      (item) => slugify(item.category || "") === categoryKey
    );
    return match?.category || categoryKey;
  }, [categories, categoryKey, categoriesLoaded]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${apiBase}/treatment/categories`);
        if (!res.ok) throw new Error("Failed to load categories");
        const data = await res.json();
        setCategories(Array.isArray(data?.categories) ? data.categories : []);
        setCategoriesLoaded(true);
      } catch (error) {
        setCategories([]);
        setCategoriesLoaded(true);
      }
    };

    fetchCategories();
  }, [apiBase]);

  useEffect(() => {
    if (!categoriesLoaded || !categoryTitle) return;
    const fetchTreatments = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${apiBase}/treatment?category=${encodeURIComponent(categoryTitle)}`
        );
        const data = await response.json();
        setTreatments(data.treatments || []);
      } catch (error) {
        console.error("Failed to fetch treatments:", error);
        setTreatments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTreatments();
  }, [apiBase, categoryTitle, categoriesLoaded]);

  const handleAddToCart = (treatment) => {
    addToCart(treatment);
    setAddedMessage(`${treatment.name} added to cart`);
    setTimeout(() => setAddedMessage(""), 2000);
  };

  const handleGoToCart = () => {
    navigate("/cart");
  };

  return (
    <section className="bg-[#d8cfb2] px-6 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[800px]">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-luxury text-[32px] text-black">{categoryTitle}</h1>
          <p className="mt-2 text-[14px] text-black/60">
            Select treatments to add to cart
          </p>
        </div>

        {/* Added Message */}
        {addedMessage && (
          <div className="mb-4 rounded-lg bg-green-100 px-4 py-2 text-center text-green-800">
            {addedMessage}
          </div>
        )}

        {/* Treatment List */}
        <div className="rounded-[20px] bg-[#f8efe7] p-6 shadow-sm">
          {loading ? (
            <div className="py-10 text-center text-black/60">Loading...</div>
          ) : treatments.length === 0 ? (
            <div className="py-10 text-center text-black/60">
              No treatments available in this category
            </div>
          ) : (
            <div className="space-y-3">
              {treatments.map((treatment) => {
                const inCart = isInCart(treatment.treatment_id);
                const quantity = getQuantity(treatment.treatment_id);
                return (
                  <div
                    key={treatment.treatment_id}
                    className={`rounded-lg border-2 p-4 transition-all ${
                      inCart
                        ? "border-green-500 bg-green-50"
                        : "border-transparent bg-white/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-luxury text-[18px] text-black">
                          {treatment.name}
                        </h3>
                        {treatment.description && (
                          <p className="mt-1 text-[12px] text-black/60">
                            {treatment.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[16px] font-semibold text-[#9b7a2f]">
                            THB {treatment.price?.toLocaleString()}
                          </div>
                        </div>

                        {inCart ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => decrementQuantity(treatment.treatment_id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-semibold">{quantity}</span>
                            <button
                              type="button"
                              onClick={() => incrementQuantity(treatment.treatment_id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 hover:bg-green-200"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddToCart(treatment)}
                            className="rounded-lg bg-[#9b7a2f] px-4 py-2 text-[12px] font-semibold text-white transition-all hover:bg-[#7d6226]"
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

        {/* Cart Button */}
        {getCartCount() > 0 && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleGoToCart}
              className="h-12 w-full max-w-xs rounded-md bg-[#9b7a2f] text-[14px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm hover:bg-[#7d6226]"
            >
              View Cart ({getCartCount()} items)
            </button>
          </div>
        )}

        {/* Back Button */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => navigate("/services")}
            className="text-[12px] text-black/60 underline hover:text-black"
          >
            Back to Services
          </button>
        </div>
      </div>
    </section>
  );
}
