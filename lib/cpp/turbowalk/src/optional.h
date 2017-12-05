template <typename T>
class Optional {
  T mValue;
  bool mIsSet = { false };
public:
  Optional() { }
  Optional(const T &value) : mValue(value), mIsSet(true) {}
  Optional(const Optional<T> &ref) : mValue(ref.mValue), mIsSet(ref.mIsSet) {}

  Optional &operator=(Optional<T> ref) {
    if (this != &ref) {
      mValue = ref.mValue;
      mIsSet = ref.mIsSet;
    }
    return *this;
  }

  Optional &operator=(const T &value) {
    mValue = value;
    mIsSet = true;
    return *this;
  }

  T operator*() const {
    return mValue;
  }

  T *operator->() const {
    return mValue;
  }

  T getOr(const T &def) const {
    return mIsSet ? mValue : def;
  }

  bool isSet() const {
    return mIsSet;
  }

  void reset() {
    mValue = T();
    mIsSet = false;
  }
};
