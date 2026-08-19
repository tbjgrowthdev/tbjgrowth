"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";
import { getStoredConsent, storeConsent } from "@/lib/cookie-consent";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    if (!getStoredConsent()) {
      setVisible(true);
    }

    const reopen = () => {
      setVisible(true);
      setShowDetails(true);
    };
    window.addEventListener("tbj-open-cookie-preferences", reopen);
    return () => window.removeEventListener("tbj-open-cookie-preferences", reopen);
  }, []);

  const acceptAll = () => {
    storeConsent({ analytics: true, marketing: true });
    setVisible(false);
  };

  const rejectNonEssential = () => {
    storeConsent({ analytics: false, marketing: false });
    setVisible(false);
  };

  const savePreferences = () => {
    storeConsent({ analytics, marketing });
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[100]"
        >
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex-shrink-0">
                <Cookie size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">We use cookies</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  We use necessary cookies to make our site work, and optional cookies to understand site usage. See our{" "}
                  <a href="#" className="underline hover:text-blue-600 dark:hover:text-blue-400">Cookie Policy</a> for details.
                </p>
              </div>
            </div>

            {showDetails && (
              <div className="space-y-2 mb-4 pl-11">
                <label className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Necessary (always on)</span>
                  <input type="checkbox" checked disabled className="w-4 h-4 rounded opacity-50" />
                </label>
                <label className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Analytics</span>
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Marketing</span>
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                </label>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pl-11">
              {showDetails ? (
                <button
                  onClick={savePreferences}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-semibold rounded-lg hover:shadow-lg transition-shadow"
                >
                  Save Preferences
                </button>
              ) : (
                <>
                  <button
                    onClick={acceptAll}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-semibold rounded-lg hover:shadow-lg transition-shadow"
                  >
                    Accept All
                  </button>
                  <button
                    onClick={rejectNonEssential}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Reject Non-Essential
                  </button>
                  <button
                    onClick={() => setShowDetails(true)}
                    className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs font-medium hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Manage Preferences
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => setVisible(false)}
              aria-label="Dismiss"
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
