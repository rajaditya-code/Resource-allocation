'use client';

import { useState, useCallback } from 'react';

export function usePagination(initialPage = 1, initialPageSize = 12) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const goToPage = useCallback((newPage) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const updateFromResponse = useCallback((response) => {
    if (response) {
      setTotalPages(response.total_pages || Math.ceil((response.total || 0) / pageSize) || 1);
      setTotalItems(response.total || response.total_count || 0);
    }
  }, [pageSize]);

  const reset = useCallback(() => {
    setPage(1);
  }, []);

  return {
    page,
    pageSize,
    totalPages,
    totalItems,
    setPage: goToPage,
    setPageSize,
    nextPage,
    prevPage,
    updateFromResponse,
    reset,
  };
}

export default usePagination;
