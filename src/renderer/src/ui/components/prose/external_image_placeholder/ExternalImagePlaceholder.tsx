import type { TFunction } from "i18next";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Modal } from "@/ui/components/modal/Modal";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { webHref } from "@/ui/utils/webHref";

/** Where mod authors are told how to host media on Nexus Mods; a placeholder until that exists. */
const HOSTING_HELP_URL = "https://www.youtube.com/watch?v=VnvfjWxhTD4";

/** How many image hosts are named before the rest are counted. */
const NAMED_HOSTS = 3;

/** An image from outside Nexus Mods, which isn't shown: where it's from, and what we know of it. */
export interface IExternalImage {
  /** The host it would have been loaded from, such as `i.imgur.com`. */
  host: string;
  /** Its alt text, if it had any. */
  alt?: string;
  /** Where it links to, if it's a link. */
  href?: string;
}

/** What placeholders for external images may do, and are told when they do it. */
export interface IExternalImagePlaceholderOptions {
  /** The page that shows the images, such as the mod's page on the website. */
  websiteUrl: string;
  /** Told a placeholder was shown, and how many images it stands for. */
  onShown?: (imageCount: number) => void;
  /** Told the website was opened, from a placeholder or its Why? dialog. */
  onViewWebsite?: (source: "placeholder" | "dialog", imageCount: number) => void;
  /** Told the Why? dialog was opened. */
  onWhyOpened?: () => void;
  /** Told one of the images' links was opened, by its domain. */
  onLinkOpened?: (domain: string) => void;
}

/** A host without its `www.`, as a link's label shows it. */
const domainOf = (href: string) => new URL(href).hostname.replace(/^www\./, "");

/** The headline: the image's alt text, or what it is, or how many there are. */
const headlineOf = (t: TFunction, images: IExternalImage[], hasLinks: boolean) => {
  const [image] = images;

  if (images.length > 1) {
    return hasLinks
      ? t("{{count}} external images with links", { count: images.length })
      : t("{{count}} external images", { count: images.length });
  }

  if (image.alt) {
    return hasLinks
      ? t("Linked image “{{alt}}”", { alt: image.alt })
      : t("“{{alt}}”", { alt: image.alt });
  }

  return hasLinks ? t("Linked external image") : t("External image");
};

/** Where the images are from: up to three hosts, then how many more. */
const sourceOf = (t: TFunction, images: IExternalImage[]) => {
  const hosts = [...new Set(images.map(({ host }) => host))];
  const named = hosts.slice(0, NAMED_HOSTS).join(", ");
  const more = hosts.length - NAMED_HOSTS;
  const from = more > 0 ? t("{{hosts}}, +{{more}} more", { hosts: named, more }) : named;

  if (images.length === 1 && images[0].alt) {
    return t("External image from {{from}} · not shown in Vortex", { from });
  }

  return t("From {{from}} · not shown in Vortex", { from });
};

type IExternalImagePlaceholderProps = IExternalImagePlaceholderOptions & {
  /** The images it stands in for: one, or a run of them with nothing between. */
  images: IExternalImage[];
};

/**
 * Stands in for images from outside Nexus Mods, which prose doesn't load: what they were, where
 * they're from, and their links, with a way to see them on the website and a Why? explaining it.
 * A run of them is one placeholder with a count. Only the images' hosts are read, never loaded.
 * Narrower than 28rem, its buttons go under the text rather than beside it.
 */
export const ExternalImagePlaceholder = ({
  images,
  websiteUrl,
  onShown,
  onViewWebsite,
  onWhyOpened,
  onLinkOpened,
}: IExternalImagePlaceholderProps) => {
  const { t } = useTranslation();
  const [isWhyOpen, setWhyOpen] = useState(false);
  const links = images.flatMap(({ href, alt }) => {
    const target = webHref(href);
    return target ? [{ href: target, label: alt || domainOf(target) }] : [];
  });
  const hasLinks = !!links.length;

  useEffect(() => {
    onShown?.(images.length);
  }, []);

  const viewWebsite = (source: "placeholder" | "dialog") => {
    window.api.shell.openUrl(websiteUrl);
    onViewWebsite?.(source, images.length);
  };

  return (
    <div className="@container my-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 rounded-sm border border-dashed border-stroke-weak bg-translucent-dark-200 p-4 text-left @md:grid-cols-[auto_minmax(0,1fr)_auto]">
        <span className="flex items-center">
          <span className="flex rounded-full bg-surface-translucent-low p-2 text-neutral-subdued">
            <Icon name="hide_image" size="sm" />
          </span>

          {images.length > 1 && (
            <Typography
              as="span"
              className="-ml-2.25 rounded-full bg-surface-high p-2 font-semibold"
              typographyType="body-sm"
            >
              {`+${images.length - 1}`}
            </Typography>
          )}
        </span>

        <span className="flex flex-col gap-y-0.5">
          <Typography
            as="span"
            appearance="moderate"
            brand="neutral-translucent"
            className="font-semibold"
            typographyType="body-sm"
          >
            {headlineOf(t, images, hasLinks)}
          </Typography>

          <Typography
            as="span"
            appearance="subdued"
            brand="neutral-translucent"
            typographyType="body-sm"
          >
            {sourceOf(t, images)}
          </Typography>
        </span>

        <span className="col-start-2 flex items-center gap-x-3 @md:col-start-auto">
          <Button
            appearance="subdued"
            brand="neutral"
            rightIcon="open_in_new"
            size="sm"
            onClick={() => viewWebsite("placeholder")}
          >
            {t("View on website")}
          </Button>

          <TypographyLink
            appearance="moderate"
            typographyType="body-sm"
            variant="primary"
            onClick={() => {
              setWhyOpen(true);
              onWhyOpened?.();
            }}
          >
            {t("Why?")}
          </TypographyLink>
        </span>

        {hasLinks && (
          <div className="col-start-2 flex flex-col gap-y-1.5 @md:col-span-2">
            <Typography
              as="span"
              appearance="subdued"
              brand="neutral-translucent"
              typographyType="body-sm"
            >
              {t("Links to")}
            </Typography>

            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {links.map(({ href, label }) => (
                <Tooltip
                  className="break-all"
                  content={href}
                  delay={{ open: 0, close: 50 }}
                  key={href}
                >
                  <span className="inline-flex">
                    <TypographyLink
                      appearance="moderate"
                      rightIcon="open_in_new"
                      typographyType="body-sm"
                      variant="primary"
                      onClick={() => {
                        window.api.shell.openUrl(href);
                        onLinkOpened?.(domainOf(href));
                      }}
                    >
                      {label}
                    </TypographyLink>
                  </span>
                </Tooltip>
              ))}
            </span>
          </div>
        )}

        <Modal
          isOpen={isWhyOpen}
          size="md"
          title={t("Why isn't this image shown?")}
          onClose={() => setWhyOpen(false)}
        >
          <div className="flex flex-col gap-y-4">
            <Typography appearance="subdued" typographyType="body-sm">
              {t(
                "Vortex only loads images stored on Nexus Mods. Images from other sites could be swapped for something harmful or used to track you, and an app doesn't have the same protections as your web browser.",
              )}
            </Typography>

            <TypographyLink
              appearance="moderate"
              className="self-start"
              typographyType="body-sm"
              variant="primary"
              onClick={() => window.api.shell.openUrl(HOSTING_HELP_URL)}
            >
              {t("Mod authors: how to host media on Nexus Mods")}
            </TypographyLink>

            <div className="flex justify-end">
              <Button
                appearance="strong"
                brand="neutral"
                rightIcon="open_in_new"
                onClick={() => {
                  setWhyOpen(false);
                  viewWebsite("dialog");
                }}
              >
                {t("View on website")}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};
