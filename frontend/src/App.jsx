
import { useEffect, useMemo, useState } from "react";import {
  Search,
  ShoppingBag,
  MapPin,
  Plus,
  Minus,
  X,
  Clock,
  Star,
  Utensils,
} from "lucide-react";
import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";
const categories = ["All", "Burgers", "Pizza", "Indian", "Sides", "Healthy", "Drinks"];


export default function App() {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderMessage, setOrderMessage] = useState("");

  const [foods, setFoods] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchMenu() {
      try {
        setLoadingMenu(true);
        setMenuError("");

        const response = await fetch(`${API_BASE_URL}/api/menu`);

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.data)) {
          throw new Error("Invalid menu response from server");
        }

        const apiFoods = result.data.map((item) => ({
          id: Number(item.id),
          name: item.name,
          category: item.category,
          price: Number(item.price),
          description: item.description || "",
          emoji: "🍽️",
          color: "#fff0df",
          rating: null,
          time: "15–30 min",
          available: Boolean(item.is_available),
        }));

        if (!cancelled) {
          setFoods(apiFoods);
        }
      } catch (error) {
        console.error("Failed to fetch menu:", error);

        if (!cancelled) {
          setMenuError(
            "Unable to load the menu. Check that the backend and MySQL are running."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingMenu(false);
        }
      }
    }

    fetchMenu();

    return () => {
      cancelled = true;
    };
  }, []);


  const visibleFoods = useMemo(
  () =>
    foods.filter(
      (food) =>
        food.available !== false &&
        (category === "All" || food.category === category) &&
        (
          food.name.toLowerCase().includes(search.toLowerCase()) ||
          food.description.toLowerCase().includes(search.toLowerCase())
        )
    ),
  [foods, category, search]
);
  const cartItems = foods.filter(
  (food) => food.available !== false && cart[food.id] > 0
);
  const itemCount = cartItems.reduce((sum, food) => sum + cart[food.id], 0);
  const total = cartItems.reduce(
    (sum, food) => sum + food.price * cart[food.id],
    0
  );

  function changeQuantity(id, amount) {
    setCart((current) => {
      const next = { ...current };
      const quantity = (next[id] || 0) + amount;
      if (quantity <= 0) delete next[id];
      else next[id] = quantity;
      return next;
    });
  }

async function handleCheckout() {
  if (cartItems.length === 0 || orderSubmitting) {
    return;
  }

  setOrderSubmitting(true);
  setOrderMessage("");

  try {
    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: cartItems.map((food) => ({
          menuItemId: food.id,
          quantity: cart[food.id],
        })),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "Unable to place your order."
      );
    }

   setOrderMessage(
  `Order #${result.data.orderId} placed successfully! Total: ₹${result.data.totalAmount}`
  );
    setCart({});
  } catch (error) {
    setOrderMessage(
      error.message || "Unable to place your order. Please try again."
    );
  } finally {
    setOrderSubmitting(false);
  }
}


  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="QuickBite home">
          <span className="brand-icon"><Utensils size={21} /></span>
          <span>quick<span className="brand-accent">bite</span></span>
        </a>

        <div className="delivery-location">
          <MapPin size={18} />
          <div>
            <small>Delivering to</small>
            <strong>Your location</strong>
          </div>
        </div>

        <button className="cart-button" onClick={() => setCartOpen(true)}>
          <ShoppingBag size={19} />
          <span>Cart</span>
          <span className="cart-count">{itemCount}</span>
        </button>
      </header>

      <main>
        <section className="hero">
          <div className="hero-content">
            <span className="eyebrow">GOOD FOOD. GOOD MOOD.</span>
            <h1>Your cravings,<br />delivered <span>fresh.</span></h1>
            <p>Discover delicious food from your favourites. Made with love, delivered to your door.</p>
            <a className="hero-cta" href="#menu">Explore the menu <span>→</span></a>
            <div className="hero-note"><Clock size={15} /> Quick delivery · Freshly prepared</div>
          </div>
          <div className="hero-art" aria-label="Illustration of delicious food">
            <div className="hero-circle"></div>
            <span className="hero-food hero-food-main">🍔</span>
            <span className="hero-food hero-food-pizza">🍕</span>
            <span className="hero-food hero-food-fries">🍟</span>
            <span className="hero-spark spark-one">✦</span>
            <span className="hero-spark spark-two">✳</span>
            <div className="floating-label"><Star size={15} fill="currentColor" /> Loved by foodies</div>
          </div>
        </section>

        <section className="menu-section" id="menu">
          <div className="section-heading">
            <div>
              <span className="eyebrow">MADE FOR YOUR APPETITE</span>
              <h2>What are you craving?</h2>
              <p>Good food is always a good idea.</p>
            </div>
            <div className="search-box">
              <Search size={18} />
              <input
                aria-label="Search food"
                placeholder="Search dishes..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={16} /></button>}
            </div>
          </div>

          <div className="category-list" aria-label="Food categories">
            {categories.map((item) => (
              <button
                key={item}
                className={`category-chip ${category === item ? "active" : ""}`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
         </div>  {loadingMenu ? (
 <div className="empty-results">
    Loading delicious food from QuickBite...
  </div>
) : menuError ? (
  <div className="empty-results" role="alert">
    <p>{menuError}</p>
    <button
      className="add-button"
      onClick={() => window.location.reload()}
    >
      Try again
    </button>
  </div>
) : (
  <div className="food-grid">
    {visibleFoods.map((food) => (
      <article className="food-card" key={food.id}>
        <div
          className="food-art"
          style={{ backgroundColor: food.color }}
        >
          <span>{food.emoji}</span>
          {food.rating !== null && (
            <span className="food-rating">
              <Star size={13} fill="currentColor" /> {food.rating}
            </span>
          )}
        </div>

        <div className="food-info">
          <div className="food-title-row">
            <h3>{food.name}</h3>
            <span className="food-price">
              ₹{food.price.toFixed(2)}
            </span>
          </div>

          <p>{food.description}</p>

          <div className="food-footer">
            <span className="food-time">
              <Clock size={14} /> {food.time}
            </span>

            <button
              className="add-button"
              disabled={food.available === false}
              onClick={() => changeQuantity(food.id, 1)}
            >
              <Plus size={16} /> Add
            </button>
          </div>

          {cart[food.id] > 0 && (
            <div className="quantity-note">
              In cart: {cart[food.id]}
            </div>
          )}
        </div>
      </article>
    ))}

    {visibleFoods.length === 0 && (
      <div className="empty-results">
        No dishes found. Try another search.
      </div>
    )}
  </div>
)}

        </section>
      </main>

      <footer className="footer">
        <a className="brand" href="#"><span className="brand-icon"><Utensils size={18} /></span><span>quick<span className="brand-accent">bite</span></span></a>
        <p>Made for good food moments.</p>
        <span>QuickBite · Learning project</span>
      </footer>

      {cartOpen && (
        <div className="cart-overlay" onClick={() => setCartOpen(false)}>
          <section
            className="cart-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Your shopping cart"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cart-header">
              <div><span className="eyebrow">YOUR SELECTION</span><h2>Your cart ({itemCount})</h2></div>
              <button className="icon-button" aria-label="Close cart" onClick={() => setCartOpen(false)}><X /></button>
            </div>
            {orderMessage && (
            <p role="status" aria-live="polite">
            {orderMessage}
            </p>
            )}
            {cartItems.length === 0 ? (
              <div className="empty-cart"><span>🛍️</span><h3>Your cart is waiting</h3><p>Add something delicious from the menu.</p></div>
            ) : (
              <>
                <div className="cart-items">
                  {cartItems.map((food) => (
                    <div className="cart-item" key={food.id}>
                      <span className="cart-item-emoji" style={{ backgroundColor: food.color }}>{food.emoji}</span>
                      <div className="cart-item-info"><strong>{food.name}</strong><span>₹{food.price} each</span></div>
                      <div className="quantity-control">
                        <button aria-label={`Remove one ${food.name}`} onClick={() => changeQuantity(food.id, -1)}><Minus size={14} /></button>
                        <span>{cart[food.id]}</span>
                        <button aria-label={`Add one ${food.name}`} onClick={() => changeQuantity(food.id, 1)}><Plus size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-total"><span>Subtotal</span><strong>₹{total}</strong></div>
                <p className="checkout-note">Delivery fees and taxes will be calculated at checkout.</p>

                <button
                    className="checkout-button"
                    onClick={handleCheckout}
                    disabled={orderSubmitting || cartItems.length === 0}
                    >
                  {orderSubmitting
                  ? "Placing order..."
                    : "Continue to checkout"}
                      {!orderSubmitting && <span> →</span>}
              </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
