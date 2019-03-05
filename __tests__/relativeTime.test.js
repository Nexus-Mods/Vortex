import relativeTime from '../src/util/relativeTime';

const t = (key) => {
  return key;
}

describe('relativeTime', () => {
  it('returns a time value', function () {
    const date = new Date();
    const result = relativeTime(date, t)
    expect(result).toEqual('seconds ago');
  });

  it('returns a time value (minute test)', function () {
    let now = new Date();
    now.setMinutes(now.getMinutes() - 1);
    const result = relativeTime(now, t)
    expect(result).toEqual('{{ count }} minute ago');
  });

  it('returns a time value (hour test)', function () {
    let now = new Date();
    now.setHours(now.getHours() - 1);
    const result = relativeTime(now, t)
    expect(result).toEqual('{{ count }} hour ago');
  });

  it('returns a time value (day test)', function () {
    let now = new Date();
    now.setHours(now.getHours() - 24);
    const result = relativeTime(now, t)
    expect(result).toEqual('{{ count }} day ago');
  });

  it('returns a time value (week test)', function () {
    let now = new Date();
    now.setHours(now.getHours() - 168);
    const result = relativeTime(now, t)
    expect(result).toEqual('{{ count }} week ago');
  });

   it('returns a time value (month test)', function () {
    let now = new Date();
    now.setMonth(now.getMonth() - 2);
    const result = relativeTime(now, t)
    expect(result).toEqual('{{ count }} month ago');
  });

   it('returns a time value (year test)', function () {
    let now = new Date();
    now.setFullYear(now.getFullYear() - 1);
    const result = relativeTime(now, t)
    expect(result).toEqual('{{ count }} year ago');
  });
});

