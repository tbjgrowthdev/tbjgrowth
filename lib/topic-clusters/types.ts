export type ClusterRole = "PILLAR" | "CLUSTER" | "SUPPORTING";

export type ClusterContentType = "POST" | "PAGE" | "CASE_STUDY" | "SERVICE";

export interface TopicClusterMember {
  contentType: ClusterContentType;
  path: string;
  title: string;
  topic: string | null;
  wordCount: number;
  role: ClusterRole;
  // Whether this member already has a live internal link to the cluster's
  // pillar (always true for the pillar itself). False means the topic is
  // shared but the page hasn't actually been wired into the pillar yet.
  linksToPillar: boolean;
}

export interface TopicCluster {
  id: string; // the pillar's path — stable per cluster
  topic: string; // the pillar's focus keyword, falling back to its title
  pillar: TopicClusterMember;
  members: TopicClusterMember[]; // cluster + supporting members, excludes the pillar itself
}
