/**
 * CollectionTile Component
 * Displays a collection card with image, metadata, and action buttons
 * Adapted from Figma design for collection browsing
 */

import * as React from 'react';
import { Button } from '../button/Button';
import { Typography } from '../typography/Typography';

export interface CollectionTileProps {
  // Data
  id: string;
  title: string;
  author: {
    name: string;
    avatar?: string;
  };
  coverImage: string;
  tags: string[];  // Max 2 tags
  stats: {
    downloads: number;
    size: string;  // e.g., '540MB'
    endorsements: number;
  };
  description: string;
  version?: string;

  // Actions
  onAddCollection?: () => void;
  onViewPage?: () => void;

  // Style
  className?: string;
}

export const CollectionTile: React.ComponentType<CollectionTileProps> = ({
  title,
  author,
  coverImage,
  tags,
  stats,
  description,
  onAddCollection,
  onViewPage,
  className,
}) => {
  // Helper to extract tag text from string or object
  const getTagText = (tag: any): string => {
    if (typeof tag === 'string') {
      return tag;
    }
    if (tag && typeof tag === 'object' && 'name' in tag) {
      return String(tag.name);
    }
    return String(tag);
  };

  // Take max 2 tags
  const displayTags = tags.slice(0, 2);

  return (
    <div className={`tw:w-full tw:max-w-[465px] tw:h-72 tw:bg-surface-mid tw:flex tw:flex-col tw:justify-start tw:items-start ${className || ''}`}>
      {/* Main content area */}
      <div className="tw:self-stretch tw:flex-1 tw:px-3 tw:pt-3 tw:rounded-tl tw:rounded-tr tw:flex tw:flex-col tw:justify-start tw:items-start tw:gap-2 tw:overflow-hidden">
        <div className="tw:self-stretch tw:flex-1 tw:inline-flex tw:justify-between tw:items-center">

          {/* Left: Image */}
          <div className="tw:w-44 tw:h-56 tw:relative">
            <img
              className="tw:w-40 tw:h-52 tw:left-0 tw:top-0 tw:absolute tw:rounded-sm tw:object-cover"
              src={coverImage}
              alt={title}
            />
          </div>

          {/* Right: Details */}
          <div className="tw:flex-1 tw:self-stretch tw:inline-flex tw:flex-col tw:justify-start tw:items-start">

            {/* Header: Title + Author */}
            <div className="tw:self-stretch tw:pl-3 tw:pb-2 tw:flex tw:flex-col tw:justify-start tw:items-start tw:gap-1">
              <Typography
                as="div"
                className="tw:self-stretch tw:justify-start tw:text-lg tw:font-semibold tw:font-['Inter'] tw:leading-relaxed"
                appearance="strong"
              >
                {title}
              </Typography>

              <div className="tw:w-72 tw:h-4 tw:inline-flex tw:justify-start tw:items-center tw:gap-1">
                {author.avatar && (
                  <img
                    src={author.avatar}
                    alt={author.name}
                    className="tw:w-4 tw:h-4 tw:rounded-full tw:bg-zinc-300"
                  />
                )}
                {!author.avatar && (
                  <div className="tw:w-4 tw:h-4 tw:bg-zinc-300 tw:rounded-full" />
                )}
                <Typography
                  as="div"
                  typographyType="body-xs"
                  appearance="moderate"
                  className="tw:justify-center tw:tracking-tight"
                >
                  {author.name}
                </Typography>
              </div>
            </div>

            {/* Tags section */}
            {displayTags.length > 0 && (
              <div className="tw:self-stretch tw:pl-3 tw:flex tw:flex-col tw:justify-start tw:items-start tw:gap-2">
                <div className="tw:self-stretch tw:py-2 tw:border-t tw:border-b tw:border-stroke-neutral-translucent-weak tw:inline-flex tw:justify-start tw:items-center tw:gap-1.5 tw:flex-wrap tw:content-center">
                  {displayTags.map((tag, index) => {
                    const tagText = getTagText(tag);
                    return (
                      <React.Fragment key={index}>
                        <Typography
                          as="div"
                          typographyType="body-xs"
                          appearance="none"
                          className={`tw:justify-center tw:tracking-tight ${
                            tagText.toLowerCase() === 'adult'
                              ? 'tw:text-danger-strong'
                              : 'tw:text-info-strong'
                          }`}
                        >
                          {tagText}
                        </Typography>
                        {index < displayTags.length - 1 && (
                          <div className="tw:w-1 tw:h-0.5 tw:origin-top-left tw:rotate-45 tw:bg-neutral-subdued" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stats section */}
            <div className="tw:self-stretch tw:pl-3 tw:inline-flex tw:justify-start tw:items-center tw:gap-5">
              <div className="tw:flex-1 tw:py-2 tw:border-b tw:border-stroke-neutral-translucent-weak tw:flex tw:justify-start tw:items-center tw:gap-5">

                {/* Downloads */}
                <div className="tw:flex tw:justify-start tw:items-center tw:gap-1 tw:overflow-hidden">
                  <div className="tw:w-4 tw:h-4 tw:relative" />
                  <Typography
                    as="div"
                    typographyType="body-xs"
                    appearance="moderate"
                    className="tw:justify-start tw:tracking-tight"
                  >
                    {stats.downloads}
                  </Typography>
                </div>

                {/* Size */}
                <div className="tw:flex tw:justify-center tw:items-center tw:gap-1 tw:overflow-hidden">
                  <div className="tw:w-4 tw:h-4 tw:relative tw:overflow-hidden" />
                  <Typography
                    as="div"
                    typographyType="body-xs"
                    appearance="moderate"
                    className="tw:justify-start tw:tracking-tight"
                  >
                    {stats.size}
                  </Typography>
                </div>

                {/* Endorsements */}
                <div className="tw:flex tw:justify-center tw:items-center tw:gap-1 tw:overflow-hidden">
                  <div className="tw:w-4 tw:h-4 tw:relative" />
                  <Typography
                    as="div"
                    typographyType="body-xs"
                    appearance="moderate"
                    className="tw:justify-start tw:tracking-tight"
                  >
                    {stats.endorsements}
                  </Typography>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="tw:self-stretch tw:flex-1 tw:pl-3 tw:py-1 tw:flex tw:flex-col tw:justify-start tw:items-start tw:gap-2">
              <Typography
                as="div"
                typographyType="body-sm"
                appearance="subdued"
                className="tw:self-stretch tw:flex-1 tw:justify-start tw:leading-tight tw:line-clamp-3"
              >
                {description}
              </Typography>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="tw:self-stretch tw:px-3 tw:py-2 tw:bg-surface-high tw:rounded-bl tw:rounded-br tw:inline-flex tw:justify-start tw:items-center tw:gap-2">
        <Button
          buttonType="primary"
          size="sm"
          onClick={onAddCollection}
        >
          Add collection
        </Button>

        <Button
          buttonType="tertiary"
          size="sm"
          onClick={onViewPage}
        >
          View page
        </Button>
      </div>
    </div>
  );
};
