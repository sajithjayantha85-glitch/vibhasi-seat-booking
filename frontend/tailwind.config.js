/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stage: '#1e293b',
        seat: {
          available: '#10b981', // emerald-500
          selected: '#f59e0b',  // amber-500
          booked: '#ef4444',    // red-500
          blocked: '#64748b'    // slate-500
        }
      }
    },
  },
  plugins: [],
}
