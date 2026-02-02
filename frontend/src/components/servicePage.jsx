import { useEffect, useMemo, useState } from "react";
import ServiceCard from "./serviceCard";

export default function ServicePage() {
  const apiBase =
    import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const imageBase = useMemo(() => {
    if (!supabaseUrl) return "";
    return `${supabaseUrl}/storage/v1/object/public/treatment/`;
  }, [supabaseUrl]);

  const slugify = (value) =>
    value
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  useEffect(() => {
    let isMounted = true;
    fetch(`${apiBase}/treatment/categories`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load categories");
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const items = Array.isArray(data?.categories) ? data.categories : [];
        setCategories(items);
      })
      .catch(() => {
        if (!isMounted) return;
        setCategories([]);
      });

    return () => {
      isMounted = false;
    };
  }, [apiBase]);

  const displayCategories = categories.map((item) => {
    const title = item.category || "Untitled";
    const rawKey = item.image_obj_key || "";
    return {
      key: slugify(title),
      title,
        image: item.image_url
          ? item.image_url
          : rawKey
            ? rawKey.startsWith("http")
              ? rawKey
              : imageBase
                ? `${imageBase}${rawKey}`
                : ""
            : "",
    };
  });

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return displayCategories;
    return displayCategories.filter((item) =>
      item.title.toLowerCase().includes(q)
    );
  }, [displayCategories, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedCategories = filteredCategories.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <section id="services" className="bg-[#E6D4B9] px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="relative z-10 mx-auto w-full max-w-205 bg-white py-5 text-center shadow-sm">
          <h2 className="font-luxury text-[26px] tracking-[0.12em] text-[#9b7a2f]">
            Services
          </h2>
        </div>

        <div className="mx-auto -mt-6 bg-[#f8efe7] px-8 pb-12 pt-10 sm:px-12 sm:pb-16">
          <div className="mx-auto mb-6 flex w-full max-w-md items-center gap-3 rounded-full border border-black/10 bg-white px-4 py-2 shadow-sm">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search service..."
              className="w-full bg-transparent text-[13px] text-black/70 placeholder:text-black/35 focus:outline-none"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[11px] font-semibold text-black/50 hover:text-black"
              >
                Clear
              </button>
            ) : null}
          </div>

          {pagedCategories.length ? (
            <div className="grid grid-cols-1 place-items-center gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
              {pagedCategories.map((category) => (
                <ServiceCard
                  key={category.key}
                  title={category.title}
                  image={category.image}
                  to={`/category/${category.key}`}
                />
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-[14px] text-black/50">
              No categories found
            </div>
          )}

          <div className="mt-10 flex items-center justify-center gap-3 text-[12px] text-black/60">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-full border border-black/10 px-4 py-1 font-semibold text-black/70 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <div>
              {currentPage} / {totalPages}
            </div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-full border border-black/10 px-4 py-1 font-semibold text-black/70 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
