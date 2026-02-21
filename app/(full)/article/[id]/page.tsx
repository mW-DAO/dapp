import React from "react";
import ArticleDetail from "@/components/article/ArticleDetail";

export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <ArticleDetail id={resolvedParams.id} />;
}
