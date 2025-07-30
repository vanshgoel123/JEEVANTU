// ... existing code ...

// Define the category options based on the image
const categoryOptions = [
  { label: "Frames & Artwork", value: "frames-artwork" },
  { label: "Apparel & Accessories", value: "apparel-accessories" },
  { label: "Bottles & Drinkware", value: "bottles-drinkware" },
  { label: "Stationery & Planners", value: "stationery-planners" },
  { label: "Handicrafts & Gifts", value: "handicrafts-gifts" }
];

// Define subcategories for each main category
const subCategoryOptions = {
  "frames-artwork": [
    { label: "Round Frame", value: "round-frame" },
    { label: "Square Frame", value: "square-frame" },
    { label: "Photo Frame with Bastar Art", value: "photo-frame-bastar" },
    { label: "Tree Tiger Painting", value: "tree-tiger-painting" },
    { label: "Wood Cast", value: "wood-cast" }
  ],
  "apparel-accessories": [
    { label: "Cap", value: "cap" },
    { label: "T-Shirt", value: "t-shirt" },
    { label: "Bag", value: "bag" }
  ],
  "bottles-drinkware": [
    { label: "Copper Bottle", value: "copper-bottle" },
    { label: "Steel Bottle", value: "steel-bottle" },
    { label: "Thermos", value: "thermos" },
    { label: "Mug", value: "mug" }
  ],
  "stationery-planners": [
    { label: "Daily Planner", value: "daily-planner" },
    { label: "Kids Daily Planner", value: "kids-daily-planner" },
    { label: "Weekly Daily Planner", value: "weekly-daily-planner" },
    { label: "Activity Book", value: "activity-book" },
    { label: "Pen", value: "pen" }
  ],
  "handicrafts-gifts": [
    { label: "Bell Metal Products", value: "bell-metal-products" },
    { label: "Gift Set", value: "gift-set" }
  ]
};

// ... existing code ...

// Replace the manual category input with dropdowns
const [selectedCategory, setSelectedCategory] = useState("");
const [selectedSubCategory, setSelectedSubCategory] = useState("");

// ... existing code ...

// In your form component, replace the manual category input with:
<div className="mb-4">
  <label htmlFor="category" className="block text-sm font-medium text-gray-700">
    Category
  </label>
  <select
    id="category"
    name="category"
    value={selectedCategory}
    onChange={(e) => {
      setSelectedCategory(e.target.value);
      setSelectedSubCategory(""); // Reset subcategory when category changes
    }}
    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
    required
  >
    <option value="">Select Category</option>
    {categoryOptions.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
</div>

{selectedCategory && (
  <div className="mb-4">
    <label htmlFor="subCategory" className="block text-sm font-medium text-gray-700">
      Sub Category
    </label>
    <select
      id="subCategory"
      name="subCategory"
      value={selectedSubCategory}
      onChange={(e) => setSelectedSubCategory(e.target.value)}
      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      required
    >
      <option value="">Select Sub Category</option>
      {subCategoryOptions[selectedCategory]?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
)}

// ... existing code ...

// When submitting the form, use the selectedCategory and selectedSubCategory values
// For example:
const handleSubmit = (e) => {
  e.preventDefault();
  // Create the product object with the selected category and subcategory
  const productData = {
    // ... other product data
    category: categoryOptions.find(cat => cat.value === selectedCategory)?.label || "",
    subCategory: subCategoryOptions[selectedCategory]?.find(sub => sub.value === selectedSubCategory)?.label || ""
  };
  
  // Submit the product data
  // ... existing submission code
};

// ... existing code ...