//import gtag from 'gtag-ga';
import ua from 'universal-analytics';

import { GA4_BETA_MEASUREMENT_ID, GA4_NEXT_MEASUREMENT_ID, GA4_STABLE_MEASUREMENT_ID } from '../constants';
import  ga4mp  from  '../ga4mp/ga4mp.esm';
import { activeGameId } from '../../../util/selectors';

class AnalyticsGA4 {
  public user: string;
  public key: { key: string, path: string };
  public uuidV4: string;
  isDebugMode: boolean = false;
  ga4track;

  constructor() {
    // Not used right now
  }

  /**
   * isUserSet returs if the user is set
   */
  public isUserSet(): boolean {
    return !!this.user;
  }

  /**
   * Sets and Initializes the Universal Analytics tracking
   */
  public start(instanceId:string, updateChannel:string, userProperties?: Record<string, any>) {

    // which measurement id shall we use? stable, beta or next
    const measurementId = this.getMeasurementIdFromUpdateChannel(updateChannel);

    this.user = instanceId;

    this.ga4track = ga4mp([measurementId], {
      user_id:  instanceId,
      debug:  this.isDebugMode,     
      is_session_start: true              
    });

    /*
    this.ga4track.trackEvent('page_view', {      
      is_session_start: true        
    });*/
    

      for (const key in userProperties) {
        this.ga4track.setUserProperty(key, userProperties[key]);
      }

    }

  /**
   * Get Google Analytics Measurement ID from env based on a users current update channel
   * @param updateChannel string from Vortex that is 'stable', 'beta' or 'next
   * @returns a Measurement ID string, defaults to stable
   */
  private getMeasurementIdFromUpdateChannel(updateChannel: string): string {

    switch(updateChannel) {
      case 'stable':
      return GA4_STABLE_MEASUREMENT_ID      
      case 'beta':
      return GA4_BETA_MEASUREMENT_ID      
      case 'next':
      return GA4_NEXT_MEASUREMENT_ID
      default:
        return GA4_STABLE_MEASUREMENT_ID 
    }
  }

  /**
   * Disable tracking for not logged in user and/or opt-out user
   */
  public stop() {
    this.user = null;
  }


  /**
   * Track a page_view event
   * @param path path of page
   * @param title title of page (optional)
   * @returns 
   */
  public trackPageView(path:string, title?:string) {

    if (!this.isUserSet()) return;

    const newPath = `/${path.replace(/\s+/g, ' ').replace(/[^a-zA-Z0-9 /-]/g, '').replaceAll(' ', '-').toLocaleLowerCase()}`;
    if(title === undefined)
      title = newPath;

    this.ga4track.trackEvent('page_view', {      
      page_title: title,
      page_location: newPath       
    });
  }


  /**
   * 
   * @param category 
   * @param label 
   * @param value 
   */
  public trackClickEvent(category:string, label?:string, value?: string | number | boolean) {
    this.trackEvent('click', category, label, value);
  }

    /**
   * 
   * @param key 
   * @param value 
   */
    public trackSettingsEvent(key:string, value: string | number | boolean) {

    // send empty page_view as we don't need it for these events and if we dont, it'll always send a default 'Vortex'
      this.ga4track.trackEvent('settings', {
        key: key,
        value: value,  
        page_title: '',
        page_location: '' 
      });
    }

  /**
   * 
   * @param action 
   * @param category 
   * @param label 
   * @param value 
   * @returns 
   */
  public trackEvent(action: string, category?: string, label?: any, value?: any) {

    if (!this.isUserSet()) return;

    // if we are activating a game, take the game and update user properties?
    if(action === "activate") {
      this.ga4track.setUserProperty("Game", value.gameId);
      this.ga4track.setUserProperty("GameVersion", value.gameVersion);
      this.ga4track.setUserProperty("GameExtensionVersion", value.extensionId);
      this.ga4track.setUserProperty("GameProfileCount", value.gameProfileCount);
    }

    // send empty page_view as we don't need it for these events and if we dont, it'll always send a default 'Vortex'
    this.ga4track.trackEvent(action, {
      category: category,
      label: label,
      value: value,
      page_title: "",
      page_location: ""     
    });
  }

  public setUserProperty(key:string, value: any) {
    // this is updated remotely the next time an event is sent
    this.ga4track.setUserProperty(key, value);
  }

}

const analyticsGa4 = new AnalyticsGA4();

export default analyticsGa4;