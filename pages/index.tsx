import { addDays, format, isFuture, parse, parseISO, subDays } from "date-fns";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { API_URL } from "../utils/constants";
import { Appearance, Fueltype } from "./_app";

interface DayPrice {
  date: string;
  price: number;
  prevPrices: {
    detectionTimestamp: string;
    price: number;
  }[];
}

type DayKind = "Today" | "Yesterday" | "Tomorrow";

interface PriceResponse {
  message: string;
  prices: {
    today: DayPrice | null;
    tomorrow: DayPrice | null;
    yesterday: DayPrice | null;
  };
}

const PriceDisplay: React.FC<{
  loading: boolean;
  price: DayPrice | null;
  day: DayKind;
  toggleDisplayChanges: () => void;
  active: boolean;
}> = ({ loading, price, day, toggleDisplayChanges, active }) => {
  const hasPriceChanged = (price?.prevPrices ?? []).length > 0;

  return (
    <div
      className={`transition flex flex-col rounded-md shadow-lg p-4 hover:bg-slate-800 bg-slate-700 text-white dark:hover:bg-slate-300 dark:bg-slate-50 dark:text-slate-900 ${hasPriceChanged ? "cursor-pointer" : "cursor-auto"
        } ${loading ? "animate-pulse" : ""} ${active ? "bg-slate-800 dark:bg-slate-300 shadow-sm" : ""
        }`}
      title={hasPriceChanged ? "Price has changed" : ""}
      role={hasPriceChanged ? "button" : "none"}
      onClick={() => hasPriceChanged && toggleDisplayChanges()}
    >
      <div className="text-xl">
        {day}
        {hasPriceChanged && <span className="text-red-500">*</span>}
      </div>
      <div className="text-center">{price?.price ?? "??.??"} kr</div>
    </div>
  );
};

const PriceChange: React.FC<{
  prevPrices: DayPrice["prevPrices"];
  day: DayKind;
}> = ({ prevPrices, day }) => {
  return (
    <div className="bg-red-100 text-slate-900 rounded-md shadow-lg p-4 m-4 flex justify-center">
      <table className="table-fixed">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 ">Change detected at</th>
            <th className="px-4 py-2 ">Price before change</th>
          </tr>
        </thead>
        <tbody>
          {prevPrices.map((p) => (
            <tr key={p.detectionTimestamp}>
              <td className="px-4 py-2">
                {format(parseISO(p.detectionTimestamp), "yyyy-MM-dd HH:mm:ss")}
              </td>
              <td className="px-4 py-2">{p.price} kr</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function getInitialDate() {
  const queryParams = new URLSearchParams(
    typeof window !== "undefined" ? window?.location.search : ""
  );
  const initialDate = parse(
    queryParams.get("now") ?? format(new Date(), "yyyy-MM-dd"),
    "yyyy-MM-dd",
    new Date()
  );
  return initialDate;
}

export const fetcher = (url: string, now: string, fueltype: Fueltype) =>
  fetch(`/api/prices?now=${now}&type=${fueltype}`).then((res) => res.json());

const Home: NextPage<{ fueltype: Fueltype; appearance: Appearance }> = ({
  fueltype,
  appearance,
}) => {
  const [priceChangeState, setPriceChangeState] = useState<{
    prevPrices: DayPrice["prevPrices"];
    day: DayKind;
  } | null>(null);

  const router = useRouter();

  const [now, setNow] = useState(getInitialDate());
  const [nowParam, setNowParam] = useState<string>(format(now, "yyyy-MM-dd"));

  const { data, error } = useSWR<PriceResponse>(
    [API_URL, nowParam, fueltype],
    // FIXME: any use. this started giving an error after @cloudflare/workers-types was added to tsconfig
    fetcher as any
  );

  useEffect(() => {
    setPriceChangeState(null);
  }, [fueltype]);

  useEffect(() => {
    const newNowParam = format(now, "yyyy-MM-dd");
    const queryObj = {
      now: newNowParam,
      bgColor: appearance.bgColor as string | undefined,
      textColor: appearance.textColor as string | undefined,
    };
    if (!queryObj.bgColor) {
      delete queryObj.bgColor;
    }
    if (!queryObj.textColor) {
      delete queryObj.textColor;
    }
    router.push({
      pathname: "/",
      query: queryObj,
    });
    setNowParam(newNowParam);
  }, [now]);

  const toggleShowPriceChange = (
    prevPrices: DayPrice["prevPrices"],
    day: DayKind
  ) => {
    if (priceChangeState?.day === day) {
      setPriceChangeState(null);
    } else {
      setPriceChangeState({
        day,
        prevPrices,
      });
    }
  };

  const changeDate = (direction: "left" | "right") => {
    let newNow: Date;
    if (direction === "left") {
      newNow = subDays(now, 1);
    } else {
      newNow = addDays(now, 1);
    }
    if (!isFuture(newNow)) {
      setNow(newNow);
      setPriceChangeState(null);
    }
  };

  return (
    <div>
      <div className="flex justify-center">
        <button
          onClick={() => changeDate("left")}
          className="mr-2"
          title="Day before"
        >
          👈
        </button>
        <div className="text-lg mr-2">{format(now, "eee dd LLL yyyy")}</div>
        <button onClick={() => changeDate("right")} title="Next day">
          ️👉
        </button>
      </div>
      {error && <p>An error has occurred</p>}
      {!error && (
        <div>
          <div className="flex flex-wrap justify-evenly mt-6">
            <PriceDisplay
              loading={!data}
              price={data?.prices?.yesterday ?? null}
              day={"Yesterday"}
              active={priceChangeState?.day === "Yesterday"}
              toggleDisplayChanges={() =>
                toggleShowPriceChange(
                  data?.prices.yesterday?.prevPrices ?? [],
                  "Yesterday"
                )
              }
            ></PriceDisplay>
            <PriceDisplay
              loading={!data}
              price={data?.prices?.today ?? null}
              day={"Today"}
              active={priceChangeState?.day === "Today"}
              toggleDisplayChanges={() =>
                toggleShowPriceChange(
                  data?.prices?.today?.prevPrices ?? [],
                  "Today"
                )
              }
            ></PriceDisplay>
            <PriceDisplay
              loading={!data}
              price={data?.prices?.tomorrow ?? null}
              day={"Tomorrow"}
              active={priceChangeState?.day === "Tomorrow"}
              toggleDisplayChanges={() =>
                toggleShowPriceChange(
                  data?.prices?.tomorrow?.prevPrices ?? [],
                  "Tomorrow"
                )
              }
            ></PriceDisplay>
          </div>

          <div className="mt-4">
            {priceChangeState !== null && (
              <PriceChange
                day={priceChangeState.day}
                prevPrices={priceChangeState.prevPrices}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
