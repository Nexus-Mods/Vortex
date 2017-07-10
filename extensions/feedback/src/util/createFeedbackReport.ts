export function createFeedbackReport(type, message, version) {

    return `### Application ${type}
      #### System
      | | |
      |------------ | -------------|
      |Platform | ${process.platform} |
      |Architecture | ${process.arch} |
      |Application Version | ${version} |
      #### Message
      ${message}
      `;
  }
