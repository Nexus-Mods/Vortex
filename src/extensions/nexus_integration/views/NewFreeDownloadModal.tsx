import * as React from 'react';
import { TFunction } from 'i18next';
import FlexLayout from '../../../controls/FlexLayout';
import { Button, Panel } from 'react-bootstrap';
import Image from '../../../controls/Image';
import { FALLBACK_AVATAR } from '../constants';

export interface INewFreeDownloadModal {
  t: TFunction;
  fileInfo: any;
}

function NewFreeDownloadModal(props: INewFreeDownloadModal) {

  const { t, fileInfo } = props;

  return (
    <div>
      <FlexLayout type='column' id='content-container'>

        {/* First row - spans full width */}
        <FlexLayout.Fixed>

          {(fileInfo !== null) ? (
            <FlexLayout type='row' id='top-row'>

              <FlexLayout.Fixed>
                <Image id='mod-thumbnail' srcs={[fileInfo.mod.pictureUrl]} />
              </FlexLayout.Fixed>

              <FlexLayout.Flex>
                <FlexLayout type='column'>
                  <div id='mod-name'>{fileInfo.mod.name}</div>
                  <div id='mod-author'>{fileInfo.mod.uploader.name}</div>
                </FlexLayout>
              </FlexLayout.Flex>

              <FlexLayout.Fixed>
                <div id='mod-count'>1 / 233 mods</div>
              </FlexLayout.Fixed>

            </FlexLayout>
          ) : (
            <FlexLayout type='row' id='top-row'>
              <FlexLayout.Fixed>
                <div>Loading...</div>
              </FlexLayout.Fixed>
            </FlexLayout>
          )}

        </FlexLayout.Fixed>

        {/* Second row - two columns */}
        <FlexLayout.Fixed>

          <FlexLayout type='row' id='bottom-row'>
            <FlexLayout.Flex>

              <FlexLayout type='column' id='free-container'>
                <div>PICTOGRAM</div>
                <div className='membership-type'>Free</div>
                <div className='title'>Download one by one</div>
                <hr />
                <ul>
                  <li>Manual download for collections</li>
                  <li>Throttled download speeds (3 MB/s)</li>
                  <li>Ads and delay for each download</li>
                </ul>                        
                <Button id='download-mod-button' onClick={() => console.log('download-mod-button clicked')}>{t('Download mod')}</Button>
              </FlexLayout>
            </FlexLayout.Flex>

            <FlexLayout.Flex>
              <FlexLayout type='column' id='premium-container'>
                <div>PICTOGRAM</div>
                <div className='membership-type'>Premium</div>
                <div className='title'>Get all your mods fast</div>
                <hr />
                <ul>
                  <li>Auto-download collections</li>
                  <li>Max download speeds</li>
                  <li>No more ads</li>
                </ul>                        
                <Button id='get-premium-button' onClick={() => console.log('get-premium-button clicked')}>{t('Auto-download all')}</Button>
              </FlexLayout>
            </FlexLayout.Flex>

          </FlexLayout>
        </FlexLayout.Fixed>
      </FlexLayout>
    </div>
  );
}

export default NewFreeDownloadModal;