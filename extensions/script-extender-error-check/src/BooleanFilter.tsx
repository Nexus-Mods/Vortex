import * as React from "react";
import { Toggle, types } from "vortex-api";

class BooleanFilterComponent extends React.Component<types.IFilterProps, {}> {
  public render(): JSX.Element {
    let { filter } = this.props;
    return <Toggle checked={filter} onToggle={this.changeFilter} />;
  }

  private changeFilter = (value) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, value);
  };
}

class BooleanFilter implements types.ITableFilter {
  public component = BooleanFilterComponent;
  public raw = false;

  public matches(filter: any, value: any): boolean {
    if (!filter) {
      return true;
    } else {
      return !!value;
    }
  }
}

export default BooleanFilter;
