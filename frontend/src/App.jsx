import Header from "./components/Header";
import ServicePage from "./components/servicePage";

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Header defaultActiveKey="services" />
      <ServicePage />
    </div>
  );
}
