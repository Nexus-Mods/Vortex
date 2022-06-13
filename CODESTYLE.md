# **Vortex code standards and style guides**
### **Clean Code: The Boy Scout Rule**
The rule of the boy scouts is: 

> Always leave the campground cleaner than you found it

When you find a mess on the ground, clean it, it doesn’t matter who did it. Your job is always to leave the ground cleaner for the next campers.

We apply this rule to our code, too; every time we have to refactor or improve old code, we also take care of updating it to our current quality standards.
## **Javascript/Typescript**
### ***Baseline***
*Unless otherwise noted below we follow the airbnb coding guidelines as formulated here: <https://github.com/airbnb/javascript>*
### **Line limit**
We agreed to have a soft limit of **100 characters per line and a hard limit of 150**; This will make it easier to have multiple files open side by side in your IDE.
### **The length of functions should not be very large:**
Lengthy functions are complicated to understand. That’s why functions should be small enough to carry out small work, and long functions should be broken into small ones for completing small tasks. 

We have a soft limit of **25 lines per function.**
#### **Async and Promises**
Use `async` and `await`, and avoid having long promise chains.

Avoid using Bluebird. Use ES6 promises instead; when vortex was written, ES Promises were incomplete, so we used Bluebird; this is not the case anymore.

To get rid of `Bluebird` we have to avoid certain constructs that are widely in use in Vortex but are Bluebird extensions:
```
somethingAsync().catch(ExceptionType, err => { … }) // NO

somethingAsync().catch(err => { if (err instanceof ExceptionType) { … } else { return Promise.reject(err); } }) // YES

Promise.map(stuff, item => somethingAsync(item)) // NO

Promise.all(stuff.map(item => somethingAsync(item))) // YES

for (const item of stuff) { await somethingAsync(item) } // ALSO YES
```
### **Naming conventions**
#### **React**
We enforce **PascalCase** for user-defined JSX components. 
```
<TestComponent />

<TestComponent>
```
#### **Types**
Use PascalCase for type names. 

```
type NotificationFunc = (dismiss: NotificationDismiss) => void;
```
#### **Interfaces**
We use I as a prefix for our interfaces. This is because most of the team has a C# background.
```
interface IBaseProps {}
```
#### **Enums**
Use PascalCase for enum values.

```
export enum Decision {}
```
#### **Functions**
Use camelCase for function names.
```
function fetchReduxState(tries: number = 5) {}
```
#### **Property names and local variables**
Use camelCase for property names and local variables.
```
let visibleLineCount = 0;

const copy = ordered.slice();
```
#### **Private properties**
Use m as a prefix for private properties. It is a bit uncommon compared to using \_ or nothing at all, but this is how we always do it, and at the moment, we have no good reason to change it.
```
class SplashScreen {

`  `private mWindow: Electron.BrowserWindow = null;

}
```
#### **Const and Globals**
We use UPPER\_SNAKE\_CASE for global and/or exported variables.
```
export const NEXUS\_MEMBERSHIP\_URL = 'https://users.nexusmods.com/register/memberships';
```
### **Function Alignment and Formatting**
#### **Parameter alignment**
Either have all parameters and return type on one line if it fits within the soft limit or one line per argument like this:
```
function convertRow<T>(t: TFunction,
                       group: string,
                       rowId: string,
                       value: T)
                       : IRow<T> {
  [...]
}
```
#### **Generic parameters**
We prefer to pass generic parameters, like api or t, as the first parameters to functions.
```
function setShortcut(api: IExtensionApi, t: TFunction, profile: IProfile) {

`  `[...]

}
```
### **Localization**
All text has to be localizable on the front-end side, excluding errors.

The localized text has to be static.

Don’t:
```
const text = something ? 'give you up' : 'let you down'

const song = t(`Never gonna ${text}`)
```
Do:
```
const text = something ? 'give you up' : 'let you down'

const song = t(`Never gonna {{ text }}`,{ replace: { text } })
```
### **File naming and folder structure**
*Proposal:
If a file contains primarily a class, interface or react component, the file name matches that class, including case (that is: UpperCamelCase).
Files primarily consisting of free-standing functions use lowerCameCase.*

### **Testing**
At the moment, we don’t aim for a 99.9999999% code coverage, but this does not mean we don’t write tests.

We agreed to write a test for all “off-path” and critical behaviors, such as changing the settings for the mod staging folders or the downloads directory. This should ensure that all critical code is tested and reliable.
