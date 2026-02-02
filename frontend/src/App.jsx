import { Navigate, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import InventoryPage from "./components/inventoryPage";
import ServicePage from "./components/servicePage";
import Footer from "./components/footer";
import NotFound from "./components/notFound";
import CustomerPage from "./components/customerPage";
import CustomerDetailPage from "./components/customerDetailPage";
import ChatPage from "./components/chatPage";
import CategoryDetailPage from "./components/categoryDetailPage";
import CartPage from "./components/cartPage";
import BookingFormPage from "./components/bookingFormPage";
import TransactionCompletedPage from "./components/transactionCompletedPage";
import ReceiptPage from "./components/receiptPage";
import AppointmentPage from "./components/appointmentPage";
import PromotionPage from "./components/promotionPage";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Navigate to="/services" replace />} />
          <Route path="/services" element={<ServicePage />} />
          <Route path="/category/:categoryKey" element={<CategoryDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/booking" element={<BookingFormPage />} />
          <Route path="/success" element={<TransactionCompletedPage />} />
          <Route path="/receipt" element={<ReceiptPage />} />
          <Route path="/promotion" element={<PromotionPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/lumina" element={<ChatPage />} />
          <Route path="/home" element={<NotFound label="Home" />} />
          <Route path="/customer" element={<CustomerPage />} />
          <Route path="/customer/:customerId" element={<CustomerDetailPage />} />
          <Route path="/appointment" element={<AppointmentPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
