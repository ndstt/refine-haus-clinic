import { createContext, useContext, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);

  const addToCart = (treatment) => {
    setCartItems((prev) => {
      // Check if already in cart - increment quantity
      const existingIndex = prev.findIndex((item) => item.treatment_id === treatment.treatment_id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
        };
        return updated;
      }
      return [...prev, { ...treatment, quantity: 1 }];
    });
  };

  const removeFromCart = (treatmentId) => {
    setCartItems((prev) => prev.filter((item) => item.treatment_id !== treatmentId));
  };

  const updateQuantity = (treatmentId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(treatmentId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.treatment_id === treatmentId ? { ...item, quantity } : item
      )
    );
  };

  const incrementQuantity = (treatmentId) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.treatment_id === treatmentId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const decrementQuantity = (treatmentId) => {
    setCartItems((prev) => {
      const item = prev.find((i) => i.treatment_id === treatmentId);
      if (item && item.quantity <= 1) {
        return prev.filter((i) => i.treatment_id !== treatmentId);
      }
      return prev.map((i) =>
        i.treatment_id === treatmentId ? { ...i, quantity: i.quantity - 1 } : i
      );
    });
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getCartTotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  };

  const getCartCount = () => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getItemCount = () => {
    return cartItems.length;
  };

  const isInCart = (treatmentId) => {
    return cartItems.some((item) => item.treatment_id === treatmentId);
  };

  const getQuantity = (treatmentId) => {
    const item = cartItems.find((i) => i.treatment_id === treatmentId);
    return item ? item.quantity : 0;
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        incrementQuantity,
        decrementQuantity,
        clearCart,
        getCartTotal,
        getCartCount,
        getItemCount,
        isInCart,
        getQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
