import type { IFileInfo, IModRequirement, IModRequirements } from "@nexusmods/nexus-api";
import numeral from "numeral";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { renderSafeBBCode } from "@/controls/bbcode";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Image } from "@/ui/components/image/Image";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { Typography } from "@/ui/components/typography/Typography";

import { installableFiles } from "../modFiles";
import type { ICatalogMod, InstallState } from "../types";
import { formatDate } from "./formatDate";
import { InstallStateLabel } from "./InstallStateLabel";

export interface IModDetailsProps {
  api: IExtensionApi;
  /** Vortex's id of the active game; the Nexus helpers convert it. */
  gameId: string;
  gameDomain: string;
  mod: ICatalogMod;
  installState: InstallState;
  isLoggedIn: boolean;
  onBack: () => void;
  onInstallFile: (file: IFileInfo) => void;
}

interface IDetailsData {
  description?: string;
  files: IFileInfo[];
  requirements: IModRequirement[];
}

/** Description and files come from the REST API, which needs a login; requirements don't. */
function useModDetails(props: IModDetailsProps) {
  const { api, gameId, mod, isLoggedIn } = props;
  const [data, setData] = useState<IDetailsData>({ files: [], requirements: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const info = isLoggedIn
      ? Promise.resolve(api.ext.nexusGetModInfo?.(gameId, mod.modId)).catch(() => undefined)
      : Promise.resolve(undefined);
    const files = isLoggedIn
      ? Promise.resolve(api.ext.nexusGetModFiles?.(gameId, mod.modId)).catch(() => [])
      : Promise.resolve([]);
    const requirements =
      mod.uid !== undefined
        ? Promise.resolve(api.ext.nexusGetModRequirements?.([mod.uid])).catch(() => undefined)
        : Promise.resolve(undefined);

    void Promise.all([info, files, requirements]).then(([infoRes, filesRes, reqRes]) => {
      if (cancelled) {
        return;
      }
      const reqs: Partial<IModRequirements> | undefined =
        mod.uid !== undefined ? reqRes?.[mod.uid] : undefined;
      setData({
        description: infoRes?.description,
        files: installableFiles(filesRes ?? []),
        requirements: reqs?.nexusRequirements?.nodes ?? [],
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [api, gameId, mod.modId, mod.uid, isLoggedIn]);

  return { data, loading };
}

export const ModDetails = (props: IModDetailsProps) => {
  const { gameDomain, mod, installState, isLoggedIn, onBack, onInstallFile } = props;
  const { t, i18n } = useTranslation(["common"]);
  const { data, loading } = useModDetails(props);
  const modUrl = `https://www.nexusmods.com/${gameDomain}/mods/${mod.modId}`;

  return (
    <div className="space-y-4 p-6" data-testid="catalog-mod-details">
      <div className="flex items-center gap-x-2">
        <Button appearance="weak" brand="neutral" leftIcon="arrow_back" size="sm" onClick={onBack}>
          {t("Back to catalog")}
        </Button>

        <Button
          appearance="weak"
          brand="neutral"
          leftIcon="open_in_new"
          size="sm"
          onClick={() => window.api.shell.openUrl(modUrl)}
        >
          {t("Open on Nexus Mods")}
        </Button>
      </div>

      <div className="flex items-start gap-x-4">
        <Image
          alt={mod.name}
          className="aspect-video w-full max-w-80 shrink-0 rounded-sm"
          fit="cover"
          imageType="mod"
          src={mod.pictureUrl ?? mod.thumbnailUrl}
        />

        <div className="flex min-w-0 flex-col gap-y-1.5">
          <Typography as="h2" className="font-semibold" typographyType="heading-sm">
            {mod.name}
          </Typography>

          <Typography appearance="moderate" typographyType="body-md">
            {t("by {{author}}", { replace: { author: mod.author } })}
            {mod.version.length > 0
              ? ` · ${t("Version {{version}}", { replace: { version: mod.version } })}`
              : ""}
          </Typography>

          <div className="flex flex-wrap items-center gap-x-1.5">
            {mod.category !== undefined && (
              <Typography brand="info" typographyType="body-sm">
                {mod.category}
              </Typography>
            )}

            <InstallStateLabel state={installState} />
          </div>

          <Typography appearance="moderate" typographyType="body-sm">
            {t("{{downloads}} downloads · {{endorsements}} endorsements · updated {{date}}", {
              replace: {
                downloads: numeral(mod.downloads).format("0,0"),
                endorsements: numeral(mod.endorsements).format("0,0"),
                date: formatDate(mod.updatedAt, i18n?.language),
              },
            })}
          </Typography>

          <Typography appearance="subdued" typographyType="body-md">
            {mod.summary}
          </Typography>
        </div>
      </div>

      <FilesSection
        files={data.files}
        isLoggedIn={isLoggedIn}
        loading={loading}
        onInstallFile={onInstallFile}
      />

      <RequirementsSection loading={loading} requirements={data.requirements} />

      <section className="space-y-2">
        <Typography as="h3" className="font-semibold" typographyType="title-sm">
          {t("Description")}
        </Typography>

        {data.description !== undefined ? (
          <div className="mod-catalog-description wrap-break-word">
            {renderSafeBBCode(data.description)}
          </div>
        ) : (
          <Typography appearance="subdued" typographyType="body-sm">
            {loading
              ? t("Loading...")
              : isLoggedIn
                ? t("No description available.")
                : t("Log in to Nexus Mods to see the full description.")}
          </Typography>
        )}
      </section>
    </div>
  );
};

const FilesSection = ({
  files,
  isLoggedIn,
  loading,
  onInstallFile,
}: {
  files: IFileInfo[];
  isLoggedIn: boolean;
  loading: boolean;
  onInstallFile: (file: IFileInfo) => void;
}) => {
  const { t, i18n } = useTranslation(["common"]);

  return (
    <section className="space-y-2">
      <Typography as="h3" className="font-semibold" typographyType="title-sm">
        {t("Files")}
      </Typography>

      {!isLoggedIn ? (
        <Typography appearance="subdued" typographyType="body-sm">
          {t("Log in to Nexus Mods to see and install files.")}
        </Typography>
      ) : loading ? (
        <Typography appearance="subdued" typographyType="body-sm">
          {t("Loading...")}
        </Typography>
      ) : files.length === 0 ? (
        <NoResults
          className="py-6"
          icon="draft"
          message={t("This mod has no files that can be installed.")}
          title={t("No files")}
        />
      ) : (
        <ul className="divide-y divide-stroke-weak rounded-md bg-surface-mid">
          {files.map((file) => (
            <li className="flex items-center gap-x-3 px-3 py-2" key={file.file_id}>
              <div className="min-w-0 grow">
                <Typography className="truncate font-semibold" typographyType="body-md">
                  {file.name}
                </Typography>

                <Typography appearance="moderate" typographyType="body-sm">
                  {[
                    file.category_name,
                    file.version,
                    numeral((file.size_kb ?? 0) * 1024).format("0.0 b"),
                    formatDate(file.uploaded_time, i18n?.language),
                  ]
                    .filter((part) => !!part)
                    .join(" · ")}
                </Typography>
              </div>

              <Button size="sm" onClick={() => onInstallFile(file)}>
                {t("Install")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const RequirementsSection = ({
  loading,
  requirements,
}: {
  loading: boolean;
  requirements: IModRequirement[];
}) => {
  const { t } = useTranslation(["common"]);

  return (
    <section className="space-y-2">
      <Typography as="h3" className="font-semibold" typographyType="title-sm">
        {t("Requirements")}
      </Typography>

      {loading ? (
        <Typography appearance="subdued" typographyType="body-sm">
          {t("Loading...")}
        </Typography>
      ) : requirements.length === 0 ? (
        <Typography appearance="subdued" typographyType="body-sm">
          {t("This mod lists no requirements.")}
        </Typography>
      ) : (
        <ul className="space-y-1">
          {requirements.map((req) => (
            <li className="flex items-center gap-x-2" key={req.id}>
              <Button
                appearance="weak"
                brand="neutral"
                rightIcon="open_in_new"
                size="sm"
                onClick={() => window.api.shell.openUrl(req.url)}
              >
                {req.modName}
              </Button>

              {!!req.notes && (
                <Typography appearance="subdued" typographyType="body-sm">
                  {req.notes}
                </Typography>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
