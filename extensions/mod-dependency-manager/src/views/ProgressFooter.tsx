import { Icon, tooltip } from 'nmm-api';
import * as React from 'react';
import { ProgressBar } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';

interface IBaseProps {
  t: ReactI18Next.TranslationFunction;
}

interface IConnectedProps {
  working: boolean;
}

type IProps = IBaseProps & IConnectedProps;

const ProgressFooter = (props: IProps) => {
  const { t, working } = props;

  return working ? (
    <div style={{ display: 'inline', marginLeft: 5, marginRight: 5 }}>
      <tooltip.Icon id='update-file-conflicts' name='bolt' tooltip={t('Updating file conflicts')} />
      <Icon name='spinner' pulse />
    </div>
  ) : null;
};

function mapStateToProps(state: any): IConnectedProps {
  return {
    working: state.session.dependencies.working,
  };
}

export default
  translate(['common', 'dependency-manager'], { wait: false })
  (connect(mapStateToProps)(ProgressFooter)) as React.ComponentClass<{}>;
