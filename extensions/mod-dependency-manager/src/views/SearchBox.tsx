import I18next from "i18next";
import * as React from "react";
import { FormControl } from "react-bootstrap";
import { ComponentEx, Icon, tooltip } from "vortex-api";

export interface ISearchMatch {
  node: any;
  path: string[];
  treeIndex: number;
}

export interface ISearchBoxProps {
  t: typeof I18next.t;
  searchString: string;
  searchFocusIndex: number;
  matches: ISearchMatch[];
  onSetSearch: (search: string) => void;
  onSetSearchFocus: (idx: number) => void;
}

interface ISearchBoxState {
  searchFoundCount: number;
}

class SearchBox extends ComponentEx<ISearchBoxProps, ISearchBoxState> {
  constructor(props: ISearchBoxProps) {
    super(props);

    this.initState({
      searchFoundCount: 0,
    });
  }

  public UNSAFE_componentWillReceiveProps(newProps: ISearchBoxProps) {
    if (newProps.matches !== this.props.matches) {
      this.updateMatches(newProps.matches);
    }
  }

  public render(): JSX.Element {
    const { t, searchFocusIndex, searchString } = this.props;
    const { searchFoundCount } = this.state;
    return (
      <div className="search-box">
        <div
          style={{ display: "inline-block", position: "relative", height: 30 }}
        >
          <FormControl
            className="search-box-input"
            type="text"
            placeholder={t("Search")}
            value={searchString || ""}
            onChange={this.startSearch}
          />
          <Icon className="search-icon" name="search" />
          <span className="search-position">
            {t("{{ pos }} of {{ total }}", {
              replace: {
                pos: searchFoundCount > 0 ? searchFocusIndex + 1 : 0,
                total: searchFoundCount || 0,
              },
            })}
          </span>
        </div>
        <tooltip.IconButton
          className="btn-embed"
          icon="search-up"
          tooltip={t("Prev")}
          type="button"
          disabled={!searchFoundCount}
          onClick={this.selectPrevMatch}
        />
        <tooltip.IconButton
          className="btn-embed"
          icon="search-down"
          tooltip={t("Next")}
          type="button"
          disabled={!searchFoundCount}
          onClick={this.selectNextMatch}
        />
      </div>
    );
  }

  private selectPrevMatch = () => {
    const { onSetSearchFocus, searchFocusIndex } = this.props;
    const { searchFoundCount } = this.state;

    onSetSearchFocus(
      (searchFoundCount + searchFocusIndex - 1) % searchFoundCount,
    );
  };

  private selectNextMatch = () => {
    const { onSetSearchFocus, searchFocusIndex } = this.props;
    const { searchFoundCount } = this.state;

    onSetSearchFocus((searchFocusIndex + 1) % searchFoundCount);
  };

  private startSearch = (event) => {
    const { onSetSearch } = this.props;
    onSetSearch(event.target.value);
  };

  private updateMatches(matches: ISearchMatch[]) {
    const { onSetSearchFocus, searchFocusIndex } = this.props;

    // important: Avoid updating the state if the values haven't changed because
    //  changing the state causes a re-render and a re-render causes the tree to search
    //  again (why?) which causes a new finish callback -> infinite loop
    if (this.state.searchFoundCount !== matches.length) {
      this.nextState.searchFoundCount = matches.length;
    }
    const newFocusIndex =
      matches.length > 0 ? searchFocusIndex % matches.length : 0;
    if (searchFocusIndex !== newFocusIndex) {
      onSetSearchFocus(newFocusIndex);
    }
  }
}

export default SearchBox;
