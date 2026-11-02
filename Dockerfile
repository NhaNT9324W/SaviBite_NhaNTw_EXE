FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY ["BackEnd/SaveBiteBE/SaveBiteBE/SaveBiteBE.csproj", "BackEnd/SaveBiteBE/SaveBiteBE/"]
RUN dotnet restore "BackEnd/SaveBiteBE/SaveBiteBE/SaveBiteBE.csproj"

COPY BackEnd/SaveBiteBE/SaveBiteBE/ BackEnd/SaveBiteBE/SaveBiteBE/
WORKDIR "/src/BackEnd/SaveBiteBE/SaveBiteBE"
RUN dotnet publish "SaveBiteBE.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "SaveBiteBE.dll"]

