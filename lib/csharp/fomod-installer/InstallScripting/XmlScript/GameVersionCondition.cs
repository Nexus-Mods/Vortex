using System;
using FomodInstaller.Interface;
using System.Threading.Tasks;

namespace FomodInstaller.Scripting.XmlScript
{
	/// <summary>
	/// A condition that requires a minimum version of the game to be installed.
	/// </summary>
	public class GameVersionCondition : VersionCondition
	{
		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_verVersion">The minimum required version of the game.</param>
		public GameVersionCondition(Version p_verVersion)
			: base(p_verVersion)
		{
		}

        #endregion

        /// <summary>
        /// Gets whether or not the condition is fulfilled.
        /// </summary>
        /// <remarks>
        /// The condition is fulfilled if the specified <see cref="File"/> is in the
        /// specified <see cref="State"/>.
        /// </remarks>
        /// <param name="coreDelegates">The Core delegates component.</param>
        /// <returns><c>true</c> if the condition is fulfilled;
        /// <c>false</c> otherwise.</returns>
        /// <seealso cref="ICondition.GetIsFulfilled(CoreDelegates)"/>
        public override bool GetIsFulfilled(ConditionStateManager csmState, CoreDelegates coreDelegates)
		{
            Version GameVersion = new Version("0.0.0.0");

            Task.Run(async () => {
                string VersionString = await coreDelegates.context.GetCurrentGameVersion();

                if (!string.IsNullOrEmpty(VersionString))
                    GameVersion = new Version(VersionString);
                else
                    GameVersion = new Version("0.0.0.0");
            }).Wait();

            return ((GameVersion != null) && (GameVersion >= MinimumVersion));
		}

        /// <summary>
        /// Gets a message describing whether or not the condition is fulfilled.
        /// </summary>
        /// <remarks>
        /// If the condition is fulfilled the message is "Passed." If the condition is not fulfilled the
        /// message uses the pattern:
        ///		File '&lt;file>' is not &lt;state>.
        /// </remarks>
        /// <param name="coreDelegates">The Core delegates component.</param>
        /// <returns>A message describing whether or not the condition is fulfilled.</returns>
        /// <seealso cref="ICondition.GetMessage(CoreDelegates)"/>
		public override string GetMessage(ConditionStateManager csmState, CoreDelegates coreDelegates)
		{
            Version GameVersion = new Version("0.0.0.0");

            Task.Run(async () => {
                string VersionString = await coreDelegates.context.GetCurrentGameVersion();

                if (!string.IsNullOrEmpty(VersionString))
                    GameVersion = new Version(VersionString);
                else
                    GameVersion = new Version("0.0.0.0");
            }).Wait();

            if (GameVersion < MinimumVersion)
				return string.Format("This mod requires v{0} or higher of the game. You have {1}. Please update your game.", MinimumVersion, GameVersion);
			return "Passed";
		}
	}
}
