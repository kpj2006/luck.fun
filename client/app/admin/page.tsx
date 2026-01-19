"use client";

import React from "react";

const AdminPage = () => {
  return (
    <div className="h-screen w-full flex items-center justify-center mx-auto text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Admin</h1>
        <p className="text-sm text-zinc-400">
          Admin initialization is handled by the backend/operator wallet in the
          EVM version.
        </p>
      </div>
    </div>
  );
};

export default AdminPage;
