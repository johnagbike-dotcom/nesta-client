import React from 'react';

export default function Button({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${
        disabled ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-b from-[#ffd74a] to-[#ffad0c]'
      } text-xl text-[#1a1405] font-bold py-3 px-6 rounded-lg shadow-md transition-colors duration-300 hover:bg-gradient-to-t`}
    >
      {children}
    </button>
  );
}
