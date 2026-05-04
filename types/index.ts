export type Difficulty = "Beginner" | "Intermediate" | "Advanced";

export type RecipeCategory =
  | "Main"
  | "Dal"
  | "Vegetarian"
  | "Bread"
  | "Breakfast"
  | "Seafood"
  | "Soup"
  | "Snack"
  | "Rice"
  | "Condiment"
  | "Dessert"
  | "Beverage"
  | "Grill"
  | "Regional"
  | "Technique"
  | "Fusion";

export type Ingredient = {
  quantity: string;
  unit: string;
  name: string;
  notes?: string;
};

export type Recipe = {
  id: string;
  course_id: string;
  title: string;
  category: RecipeCategory;
  difficulty: Difficulty;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  ingredients: Ingredient[] | null;
  steps: string[] | null;
  tips: string[] | null;
  image_url: string | null;
  sort_order: number;
  created_at: string;
};

export type Course = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  price_cents: number;
  difficulty: string;
  recipe_count: number;
  image_url: string | null;
  published: boolean;
  is_bundle: boolean;
  bundle_course_ids: string[] | null;
  stripe_price_id: string | null;
  region: string | null;
  preview_video_url: string | null;
  created_at: string;
  recipes?: Recipe[];
};

export type OrderStatus = "pending" | "paid" | "refunded";

export type Order = {
  id: string;
  user_id: string;
  course_id: string;
  stripe_payment_intent_id: string;
  amount_cents: number;
  currency: string;
  status: OrderStatus;
  invoice_number: string;
  customer_email: string;
  customer_name: string | null;
  stripe_last4: string | null;
  parent_order_id: string | null;
  created_at: string;
  course?: Course;
};

export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
};

export type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  source: string;
  sampler_sent_at: string | null;
  last_drip_step: number;
  last_drip_sent_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
};

export type Review = {
  id: string;
  course_id: string;
  order_id: string | null;
  rating: number;
  body: string | null;
  customer_name: string;
  customer_email: string;
  token: string;
  published: boolean;
  created_at: string;
};

export type Coupon = {
  id: string;
  code: string;
  discount_percent: number | null;
  discount_cents: number | null;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  applies_to_course_ids: string[] | null;
  is_active: boolean;
  created_at: string;
};

export type Reservation = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  party_size: number;
  preferred_date: string | null;
  notes: string | null;
  source: string;
  created_at: string;
};

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "incomplete";

export type Subscription = {
  id: string;
  user_id: string;
  course_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  status: SubscriptionStatus;
  monthly_cents: number;
  total_cents: number;
  installments_total: number;
  installments_paid: number;
  customer_email: string;
  customer_name: string | null;
  started_at: string;
  canceled_at: string | null;
  created_at: string;
};

export type Certificate = {
  id: string;
  order_id: string;
  course_id: string;
  customer_name: string;
  customer_email: string;
  certificate_url: string | null;
  issued_at: string;
};

export type GiftOrder = {
  id: string;
  sender_order_id: string;
  sender_email: string;
  sender_name: string | null;
  recipient_email: string;
  recipient_name: string | null;
  course_id: string;
  message: string | null;
  redemption_token: string;
  redeemed_at: string | null;
  redeemed_order_id: string | null;
  created_at: string;
};
