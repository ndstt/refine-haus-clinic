import { Navigate, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import InventoryPage from "./components/inventoryPage";
import ServicePage from "./components/servicePage";
import Footer from "./components/footer";
import NotFound from "./components/notFound";
import CustomerPage from "./components/customerPage";
import ChatPage from "./components/chatPage";
import ServiceDetailPage from "./components/serviceDetailPage";
import CategoryDetailPage from "./components/categoryDetailPage";
import BookingTimePage from "./components/bookingTimePage";
import BookingFormPage from "./components/bookingFormPage";
import PaymentMethodPage from "./components/paymentMethodPage";
import TransactionCompletedPage from "./components/transactionCompletedPage";
import ReceiptPage from "./components/receiptPage";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Navigate to="/services" replace />} />
          <Route path="/services" element={<ServicePage />} />
          <Route path="/services/:serviceKey" element={<ServiceDetailPage />} />
          <Route path="/category/:categoryKey" element={<CategoryDetailPage />} />
          <Route path="/booking-time" element={<BookingTimePage />} />
          <Route path="/booking" element={<BookingFormPage />} />
          <Route path="/payment" element={<PaymentMethodPage />} />
          <Route path="/success" element={<TransactionCompletedPage />} />
          <Route path="/receipt" element={<ReceiptPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/lumina" element={<ChatPage />} />
          <Route path="/home" element={<NotFound label="Home" />} />
          <Route path="/customer" element={<CustomerPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
