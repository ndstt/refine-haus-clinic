import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function BookingFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const treatment = location.state?.treatment;

  const [searchQuery, setSearchQuery] = useState("");
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [dateBooking, setDateBooking] = useState("");
  const [timeBooking, setTimeBooking] = useState("");
  const [note, setNote] = useState("");

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const treatmentName = treatment?.name ?? "Treatment";
  const price = treatment?.price ?? 0;

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

  const handlePayment = () => {
    navigate("/success", {
      state: {
        treatment,
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

            <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-black/50">
                Summary
              </div>
              <div className="mt-2 text-[18px] font-semibold text-black">{treatmentName}</div>

              <div className="mt-5 space-y-2 text-[12px] text-black/70">
                <div className="flex items-center justify-between">
                  <span>Treatment</span>
                  <span className="font-semibold text-black">{treatmentName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Price</span>
                  <span className="font-semibold text-black">THB {price?.toLocaleString()}</span>
                </div>
                {name && (
                  <div className="flex items-center justify-between">
                    <span>Customer</span>
                    <span className="font-semibold text-black">{name}</span>
                  </div>
                )}
                <div className="border-t border-black/10 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="font-semibold text-[#9b7a2f]">THB {price?.toLocaleString()}</span>
                  </div>
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
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
