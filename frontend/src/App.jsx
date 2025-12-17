import { Navigate, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import ServicePage from "./components/servicePage";
import Footer from "./components/footer";
import NotFound from "./components/notFound";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Navigate to="/services" replace />} />
          <Route path="/services" element={<ServicePage />} />
          <Route path="/home" element={<NotFound label="Home" />} />
          <Route path="/blog" element={<NotFound label="Blog" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
