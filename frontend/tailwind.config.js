/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: {
            50: '#f0fdfa',
            100: '#ccfbf1',
            500: '#14b8a6',
            600: '#0d9488',
            700: '#0f766e',
            800: '#115e59',
            900: '#134e4a',
          },
          green: {
            50: '#f0fdf4',
            100: '#dcfce7',
            500: '#4ade80',
            600: '#16a34a',
            700: '#15803d',
            800: '#166534',
          },
          blue: {
            50: '#f0f9ff',
            100: '#e0f2fe',
            500: '#38bdf8',
            600: '#0284c7',
            700: '#0369a1',
          },
          dark: {
            sidebar: '#0B1120',
            panel: '#131B2E',
            border: '#1E293B',
          },
          neutral: {
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            700: '#334155',
            900: '#0f172a',
          }
        },
        status: {
          success: {
            bg: '#dcfce7',
            text: '#15803d',
            border: '#bbf7d0',
          },
          info: {
            bg: '#e0f2fe',
            text: '#0369a1',
            border: '#bae6fd',
          },
          warning: {
            bg: '#fef3c7',
            text: '#b45309',
            border: '#fde68a',
          },
          error: {
            bg: '#fee2e2',
            text: '#b91c1c',
            border: '#fecaca',
          }
        }
      },
      borderRadius: {
        'brand-sm': '0.375rem',
        'brand-md': '0.5rem',
        'brand-lg': '0.75rem',
        'brand-full': '9999px',
      },
      boxShadow: {
        'brand-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'brand-md': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
        'brand-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
      }
    },
  },
  plugins: [],
}
