import * as React from "react";
import { FlexLayout, tooltip, types, util } from "vortex-api";

interface IBaseProps {
  modId: string;
  collections: types.IMod[];
  detailCell: boolean;
}

type IProps = IBaseProps;

function TooltipItem(props: { name: string }) {
  const { name } = props;
  return <li>{name}</li>;
}

function Tooltip(props: { collectionNames: string[] }) {
  const { collectionNames } = props;

  return (
    <ul className="collection-mods-page-attrib-tooltip">
      {collectionNames.map((name, idx) => (
        <TooltipItem key={`${name}${idx}`} name={name} />
      ))}
    </ul>
  );
}

function nop() {
  // nop
}

function CollectionCount(props: { collectionNames: string[]; modId: string }) {
  const { collectionNames, modId } = props;
  const filtered = collectionNames.slice(1);
  const tip = <Tooltip collectionNames={filtered} />;
  return (
    <tooltip.Button
      id={`${modId}-collection-count`}
      className="collection-mods-page-attr-addendum"
      tooltip={tip}
      onClick={nop}
    >
      {`+${filtered.length}`}
    </tooltip.Button>
  );
}

function CollectionModsPageAttributeRenderer(props: IProps) {
  const { collections, detailCell, modId } = props;

  const collectionNames = collections.map((collection) =>
    util.renderModName(collection),
  );

  const count = collectionNames.length;
  return count > 0 ? (
    <FlexLayout type="row" className="collection-mods-page-attribute-renderer">
      <FlexLayout.Fixed>
        {detailCell ? (
          <ul>
            {collectionNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ) : (
          <div>{collectionNames[0]}</div>
        )}
      </FlexLayout.Fixed>
      {count > 1 && !detailCell ? (
        <CollectionCount collectionNames={collectionNames} modId={modId} />
      ) : null}
    </FlexLayout>
  ) : null;
}

export default CollectionModsPageAttributeRenderer as React.ComponentType<IBaseProps>;
