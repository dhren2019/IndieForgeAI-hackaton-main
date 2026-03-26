import React from "react";

export function FeedSkeleton() {
  return (
    <div className="feed-skeleton">
      {[0, 1, 2].map((i) => (
        <div key={i} className="feed-skeleton__card" style={{ animationDelay: `${i * 0.12}s` }}>
          <div className="feed-skeleton__header">
            <div className="feed-skeleton__avatar" />
            <div className="feed-skeleton__meta">
              <div className="feed-skeleton__line feed-skeleton__line--name" />
              <div className="feed-skeleton__line feed-skeleton__line--date" />
            </div>
          </div>
          <div className="feed-skeleton__line feed-skeleton__line--title" />
          <div className="feed-skeleton__line feed-skeleton__line--body" />
          <div className="feed-skeleton__line feed-skeleton__line--body feed-skeleton__line--short" />
          <div className="feed-skeleton__image" />
          <div className="feed-skeleton__footer">
            <div className="feed-skeleton__pill" />
            <div className="feed-skeleton__pill" />
            <div className="feed-skeleton__pill feed-skeleton__pill--wide" />
          </div>
        </div>
      ))}
      <div className="feed-skeleton__orbs" aria-hidden="true">
        <span className="feed-skeleton__orb feed-skeleton__orb--1" />
        <span className="feed-skeleton__orb feed-skeleton__orb--2" />
        <span className="feed-skeleton__orb feed-skeleton__orb--3" />
      </div>
    </div>
  );
}

export default FeedSkeleton;
