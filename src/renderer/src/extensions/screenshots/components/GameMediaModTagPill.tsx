import type { ForwardRefExoticComponent, RefAttributes } from "react";
import React, { forwardRef } from "react";
import type { ReactNode } from "react-markdown";

import { Icon } from "@/ui/components/icon/Icon";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { XOr } from "@/ui/utils/types";

import type { GameMediaModTag } from "../util/mediaTypes";

export type IGameMediaModTagPillAppearance = "subdued" | "scrim" | "none" | "moderate";

export type IGameMediaModTagPillBrand =
  | "primary"
  | "info"
  | "neutral"
  | "light"
  | "success"
  | "danger"
  | "warning"
  | "premium";

type IBaseGameMediaModTagProps = {
  appearance?: IGameMediaModTagPillAppearance;
  brand?: IGameMediaModTagPillBrand;
} & XOr<{ iconPath?: string }, { icon?: ReactNode }>;

type IGameMediaModTagProps = {
  tag: GameMediaModTag;
  onRemove: () => void;
  className?: string;
  disabled?: boolean;
} & IBaseGameMediaModTagProps;

type IGameMediaModTag = ForwardRefExoticComponent<
  IGameMediaModTagProps & RefAttributes<HTMLSpanElement>
>;

const getTagClasses = (
  {
    appearance = "moderate",
    brand = "neutral",
  }: Pick<IBaseGameMediaModTagProps, "appearance" | "brand">,
  className?: string,
) =>
  joinClasses([
    "nxm-pill",
    `nxm-button-${brand}`,
    `nxm-button-${appearance}`,
    "justify-content-space-between m-0.5 inline-flex max-w-36 rounded-sm py-0.5 hover:bg-surface-translucent-high",
    className,
  ]);

const Content = ({
  icon,
  iconPath,
  label,
  onRemove,
}: Pick<IGameMediaModTagProps, "icon" | "iconPath" | "onRemove"> & { label?: string }) => (
  <>
    <span className="nex-pill-label line-clamp-1">{label}</span>

    {!!icon && (
      <span
        className="nxm-pill-icon flex items-center justify-center hover:cursor-pointer"
        onClick={onRemove}
      >
        {icon}
      </span>
    )}

    {!!iconPath && (
      <Icon
        className="nxm-pill-icon flex items-center justify-center hover:cursor-pointer"
        path={iconPath}
        size="none"
        onClick={onRemove}
      />
    )}
  </>
);

const GameMediaModTagPill: IGameMediaModTag = forwardRef<HTMLSpanElement, IGameMediaModTagProps>(
  (allProps, ref) => {
    const { tag, onRemove, appearance, brand, className, icon, iconPath, ...rest } = allProps;

    const content = (
      <Content icon={icon} iconPath={iconPath} label={tag.name} onRemove={onRemove} />
    );

    const tooltip = tag ? (
      <div className="flex items-center gap-2 p-2">
        {!!tag.thumbnail && <img className="aspect-mod w-24 rounded-sm" src={tag.thumbnail} />}

        <div className="w-48">
          <Typography
            brand="neutral"
            className="line-clamp-2"
            title={tag.name}
            typographyType="body-sm"
          >
            {tag.comment ? tag.comment : <a href={tag.url}>{tag.name}</a>}
          </Typography>

          {!!tag.comment && (
            <Typography appearance="subdued" className="mt-1 line-clamp-2" typographyType="body-xs">
              <a href={tag.url}>{tag.name}</a>
            </Typography>
          )}
        </div>
      </div>
    ) : null;

    return (
      <Tooltip interactive customContent={tooltip} placement="left-start">
        <span className={getTagClasses({ appearance, brand }, className)} ref={ref} {...rest}>
          {content}
        </span>
      </Tooltip>
    );
  },
);

GameMediaModTagPill.displayName = "Game Media Mod Tag Pill";

export default GameMediaModTagPill;
