import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CATEGORIES } from "../data/service";

export default function CategoryDetailPage() {
  const { categoryKey } = useParams();
  const navigate = useNavigate();

  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTreatment, setSelectedTreatment] = useState(null);

  // Find category info from CATEGORIES
  const category = CATEGORIES.find((c) => c.key === categoryKey);
  const categoryTitle = category?.title || categoryKey;

  useEffect(() => {
    const fetchTreatments = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `http://localhost:8000/api/v1/treatment?category=${encodeURIComponent(categoryTitle)}`
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
  }, [categoryTitle]);

  const handleSelect = (treatment) => {
    setSelectedTreatment(treatment);
  };

  const handleBooking = () => {
    if (selectedTreatment) {
      navigate("/booking-time", { state: { treatment: selectedTreatment } });
    }
  };

  return (
    <section className="bg-[#d8cfb2] px-6 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[800px]">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-luxury text-[32px] text-black">{categoryTitle}</h1>
          <p className="mt-2 text-[14px] text-black/60">
            Select a treatment to continue
          </p>
        </div>

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
              {treatments.map((treatment) => (
                <div
                  key={treatment.treatment_id}
                  onClick={() => handleSelect(treatment)}
                  className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                    selectedTreatment?.treatment_id === treatment.treatment_id
                      ? "border-[#9b7a2f] bg-white"
                      : "border-transparent bg-white/60 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-luxury text-[18px] text-black">
                        {treatment.name}
                      </h3>
                      {treatment.description && (
                        <p className="mt-1 text-[12px] text-black/60">
                          {treatment.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[16px] font-semibold text-[#9b7a2f]">
                        THB {treatment.price?.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Book Button */}
        {selectedTreatment && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleBooking}
              className="h-12 w-full max-w-xs rounded-md bg-[#9b7a2f] text-[14px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm hover:bg-[#7d6226]"
            >
              Book Now - THB {selectedTreatment.price?.toLocaleString()}
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
