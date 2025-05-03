/** @type {import('tailwindcss').Config} */
export default {
    theme: {
      extend: {
        animation: {
          border: "border-rotate 4s linear infinite",
        },
        keyframes: {
          "border-rotate": {
            from: { "--border-angle": "0deg" },
            to: { "--border-angle": "360deg" },
          },
        },
      },
    },
  };
  
  