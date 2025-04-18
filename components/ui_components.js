import React from "react";

export const Card = ({ children, className = "" }) => (
  <div className={`bg-white p-4 shadow-lg rounded-lg ${className}`}>{children}</div>
);

export const CardContent = ({ children }) => <div>{children}</div>;

export const Button = ({ children, className = "", ...props }) => (
  <button
    className={`bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const Input = ({ className = "", ...props }) => (
  <input
    className={`w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    {...props}
  />
);

export const Label = ({ children }) => (
  <label className="block text-gray-700 font-semibold mb-1">{children}</label>
);
