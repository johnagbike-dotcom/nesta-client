// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import BookingsPage from "./pages/BookingsPage";
// ...other imports

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* your other routes */}
        <Route path="/bookings" element={<BookingsPage />} />
      </Routes>
    </BrowserRouter>
  );
} 